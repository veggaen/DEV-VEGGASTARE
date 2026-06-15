import { dbPrisma } from '@/lib/db';
import { z } from 'zod';

const PRODUCT_REPO_ACCESS_SPEC_KEY = '__repo_access';

const RepoAccessConfigSchema = z
  .object({
    owner: z.string().trim().min(1).max(100),
    repo: z.string().trim().min(1).max(100),
    mode: z.enum(['COLLABORATOR', 'TEAM']).default('COLLABORATOR'),
    permission: z.enum(['pull', 'push', 'maintain', 'admin']).default('pull'),
    org: z.string().trim().min(1).max(100).optional(),
    teamSlug: z.string().trim().min(1).max(100).optional(),
    defaultBranch: z.string().trim().min(1).max(100).optional(),
    previewBranch: z.string().trim().min(1).max(100).optional(),
    devBranch: z.string().trim().min(1).max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type RepoAccessConfig = z.infer<typeof RepoAccessConfigSchema>;

type ProductSpecification = {
  key: string;
  value: string | number;
};

function toSpecificationsArray(specifications: unknown): ProductSpecification[] {
  const parsedValue = typeof specifications === 'string' ? safeParseJson(specifications) : specifications;
  if (!Array.isArray(parsedValue)) return [];

  return parsedValue
    .filter((entry): entry is { key: unknown; value: unknown } => !!entry && typeof entry === 'object')
    .map((entry) => ({
      key: String(entry.key ?? ''),
      value: typeof entry.value === 'number' ? entry.value : String(entry.value ?? ''),
    }))
    .filter((entry) => entry.key.length > 0);
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeAccountLogin(value: string): string {
  return value.trim().replace(/^@+/, '');
}

export function getProductRepoAccessConfig(specifications: unknown): RepoAccessConfig | null {
  const specs = toSpecificationsArray(specifications);
  const rawEntry = specs.find((entry) => entry.key === PRODUCT_REPO_ACCESS_SPEC_KEY);
  if (!rawEntry) return null;

  const parsedPayload =
    typeof rawEntry.value === 'string'
      ? safeParseJson(rawEntry.value)
      : rawEntry.value;

  const parsedConfig = RepoAccessConfigSchema.safeParse(parsedPayload);
  if (!parsedConfig.success) return null;
  return parsedConfig.data;
}

export function setProductRepoAccessConfig(
  specifications: unknown,
  config: RepoAccessConfig | null,
): ProductSpecification[] {
  const specs = toSpecificationsArray(specifications).filter((entry) => entry.key !== PRODUCT_REPO_ACCESS_SPEC_KEY);
  if (!config) return specs;

  const validated = RepoAccessConfigSchema.parse(config);
  specs.push({
    key: PRODUCT_REPO_ACCESS_SPEC_KEY,
    value: JSON.stringify(validated),
  });
  return specs;
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_REPO_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('Missing GITHUB_REPO_ACCESS_TOKEN (or GITHUB_TOKEN)');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function resolveGithubLogin(providerAccountId: string): Promise<string> {
  const normalized = normalizeAccountLogin(providerAccountId);
  if (!normalized) {
    throw new Error('GitHub account id is empty');
  }

  if (/^\d+$/.test(normalized)) {
    const user = await githubRequest(`/user/${normalized}`);
    const login = typeof user?.login === 'string' ? user.login : null;
    if (!login) throw new Error(`Unable to resolve GitHub login for account id ${normalized}`);
    return login;
  }

  return normalized;
}

async function grantCollaboratorAccess(config: RepoAccessConfig, username: string) {
  return githubRequest(`/repos/${config.owner}/${config.repo}/collaborators/${username}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission: config.permission }),
  });
}

async function grantTeamAccess(config: RepoAccessConfig, username: string) {
  const org = config.org ?? config.owner;
  if (!config.teamSlug) {
    throw new Error('TEAM mode requires teamSlug');
  }

  return githubRequest(`/orgs/${org}/teams/${config.teamSlug}/memberships/${username}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'member' }),
  });
}

export async function grantRepoAccessForOrder(orderId: string, source: string) {
  const enabled = process.env.GITHUB_REPO_ACCESS_ENABLED === '1';
  if (!enabled) {
    return { orderId, granted: 0, skipped: 0, disabled: true };
  }

  const order = await dbPrisma.order.findUnique({
    where: { id: orderId },
    include: {
      User: { select: { id: true } },
      OrderItem: {
        include: {
          Product: {
            select: {
              id: true,
              title: true,
              productType: true,
              specifications: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const githubAccount = await dbPrisma.account.findFirst({
    where: { userId: order.userId, provider: 'github' },
    select: { providerAccountId: true },
  });

  if (!githubAccount?.providerAccountId) {
    await dbPrisma.paymentWebhookEvent.create({
      data: {
        provider: 'github_repo_access',
        eventType: 'ORDER_REPO_ACCESS_SKIPPED',
        signatureVerified: true,
        orderId,
        orderStatus: order.status,
        paymentStatus: 'NO_GITHUB_ACCOUNT',
        rawPayload: { source, reason: 'No linked GitHub account' },
      },
    });
    return { orderId, granted: 0, skipped: order.OrderItem.length, reason: 'NO_GITHUB_ACCOUNT' };
  }

  const username = await resolveGithubLogin(githubAccount.providerAccountId);
  let granted = 0;
  let skipped = 0;
  const results: Array<{ productId: string; productTitle: string; status: 'granted' | 'skipped' | 'failed'; reason?: string }> = [];

  for (const item of order.OrderItem) {
    const product = item.Product;
    const isDigital = product.productType === 'DIGITAL' || product.productType === 'HYBRID';
    if (!isDigital) {
      skipped += 1;
      results.push({
        productId: product.id,
        productTitle: product.title,
        status: 'skipped',
        reason: 'NON_DIGITAL_PRODUCT',
      });
      continue;
    }

    const config = getProductRepoAccessConfig(product.specifications);
    if (!config) {
      skipped += 1;
      results.push({
        productId: product.id,
        productTitle: product.title,
        status: 'skipped',
        reason: 'NO_REPO_ACCESS_CONFIG',
      });
      continue;
    }

    try {
      if (config.mode === 'TEAM') {
        await grantTeamAccess(config, username);
      } else {
        await grantCollaboratorAccess(config, username);
      }
      granted += 1;
      results.push({ productId: product.id, productTitle: product.title, status: 'granted' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown grant error';
      results.push({
        productId: product.id,
        productTitle: product.title,
        status: 'failed',
        reason: message,
      });
    }
  }

  await dbPrisma.paymentWebhookEvent.create({
    data: {
      provider: 'github_repo_access',
      eventType: 'ORDER_REPO_ACCESS_RESULT',
      signatureVerified: true,
      orderId,
      orderStatus: order.status,
      paymentStatus: granted > 0 ? 'CAPTURED' : 'PENDING',
      rawPayload: {
        source,
        username,
        granted,
        skipped,
        results,
      },
    },
  });

  return { orderId, granted, skipped, username, results };
}

export { RepoAccessConfigSchema };
