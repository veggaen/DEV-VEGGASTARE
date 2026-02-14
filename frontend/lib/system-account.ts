/**
 * VeggaSystem - The official system account for platform updates and changelogs
 * 
 * This account posts automatic updates when new versions are deployed,
 * and admins can post on its behalf for announcements.
 */

import { dbPrisma as db } from "@/lib/db";

// System account constants
export const SYSTEM_ACCOUNT = {
  id: "system-vegga-official",
  name: "VeggaSystem",
  username: "veggasystem",
  email: "system@veggat.com",
  /** Notifications and admin emails for the system account route here */
  ownerEmail: "v3ggat@gmail.com",
  bio: "🤖 Official system account for Veggat platform updates, changelogs, and announcements. Stay tuned for the latest vibes!",
  // Using a data URI for a simple system robot emoji avatar
  image: "https://api.dicebear.com/7.x/bottts/svg?seed=veggasystem&backgroundColor=10b981",
  banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop", // Tech/space banner
  /** @deprecated Use wallets map instead */
  walletAddress: "0x018F6bF56814Dfa2543f98041e44A202b3632636" as const,
  /** Multi-chain wallet addresses */
  wallets: {
    evm: "0x018F6bF56814Dfa2543f98041e44A202b3632636" as const,        // Ethereum + PulseChain
    solana: "CKtrK9x1Hdtxt3JPpGVUDvoQgfhoGB24ecjsXYdzYnLx" as const,   // Solana mainnet
    bitcoin: "bc1qsyk5zhe5qtemv537ayd88nde58nsjtxhru6vas" as const,      // Bitcoin
    pulsechain: "0x018F6bF56814Dfa2543f98041e44A202b3632636" as const,  // Same as EVM (PulseChain is EVM-compat)
  },
} as const;

// Check if a user is the system account
export function isSystemAccount(userId: string): boolean {
  return userId === SYSTEM_ACCOUNT.id;
}

/**
 * Resolve the effective notification email for a user.
 * System account emails route to the owner's real email.
 */
export function resolveNotificationEmail(userId: string, userEmail: string | null): string | null {
  if (isSystemAccount(userId)) return SYSTEM_ACCOUNT.ownerEmail;
  return userEmail;
}

// Check if user can post as system (OWNER or ADMIN role)
export async function canPostAsSystem(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  return user?.role === "OWNER" || user?.role === "ADMIN";
}

// Ensure system account exists in database with all multi-chain wallets
export async function ensureSystemAccount(): Promise<string> {
  const existing = await db.user.findUnique({
    where: { id: SYSTEM_ACCOUNT.id },
    include: { Wallet: true },
  });

  if (existing) {
    // Ensure wallets exist even if account was created before multi-chain support
    await ensureSystemWallets(existing.id, existing.Wallet);
    return existing.id;
  }

  // Create the system account
  const systemUser = await db.user.create({
    data: {
      id: SYSTEM_ACCOUNT.id,
      name: SYSTEM_ACCOUNT.name,
      email: SYSTEM_ACCOUNT.email,
      image: SYSTEM_ACCOUNT.image,
      banner: SYSTEM_ACCOUNT.banner,
      bio: SYSTEM_ACCOUNT.bio,
      role: "ADMIN", // System has admin privileges
      emailVerified: new Date(),
      verificationTier: "FULLY_VERIFIED",
      verificationScore: 100,
      web3ModeEnabled: true,
      hasVerifiedWallet: true,
    },
  });

  // Create all wallets
  await ensureSystemWallets(systemUser.id, []);

  return systemUser.id;
}

/** Create system wallet records if they don't exist yet */
async function ensureSystemWallets(
  userId: string,
  existingWallets: Array<{ address: string; family: string }>
) {
  const existingAddresses = new Set(existingWallets.map((w) => w.address.toLowerCase()));

  const walletsToCreate: Array<{
    label: string;
    family: "EVM" | "SOLANA" | "BITCOIN";
    address: string;
    chainId?: number;
    isDefault: boolean;
  }> = [
    {
      label: "VeggaSystem ETH",
      family: "EVM",
      address: SYSTEM_ACCOUNT.wallets.evm,
      chainId: 1, // Ethereum mainnet
      isDefault: true,
    },
    {
      label: "VeggaSystem PulseChain",
      family: "EVM",
      address: SYSTEM_ACCOUNT.wallets.pulsechain,
      chainId: 369, // PulseChain mainnet
      isDefault: false,
    },
    {
      label: "VeggaSystem Solana",
      family: "SOLANA",
      address: SYSTEM_ACCOUNT.wallets.solana,
      isDefault: false,
    },
    {
      label: "VeggaSystem Bitcoin",
      family: "BITCOIN",
      address: SYSTEM_ACCOUNT.wallets.bitcoin,
      isDefault: false,
    },
  ];

  // Deduplicate: EVM + PulseChain share the same address — only create once per unique (address, family, chainId)
  const seen = new Set<string>();
  for (const w of walletsToCreate) {
    const key = `${w.address.toLowerCase()}:${w.family}:${w.chainId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (existingAddresses.has(w.address.toLowerCase())) continue;
    existingAddresses.add(w.address.toLowerCase()); // prevent double-creating same address

    await db.wallet.create({
      data: {
        label: w.label,
        family: w.family,
        address: w.address,
        chainId: w.chainId,
        isDefault: w.isDefault,
        ownerUserId: userId,
        verifiedAt: new Date(), // System wallets are pre-verified
      },
    });
  }
}

// Create a system update pulse (changelog/announcement)
export async function createSystemPulse({
  title,
  content,
  tags = ["update", "changelog"],
  postedByUserId,
}: {
  title: string;
  content: string;
  tags?: string[];
  postedByUserId: string; // The admin who triggered this
}): Promise<{ conversationId: string; notificationCount: number }> {
  // Ensure system account exists
  await ensureSystemAccount();
  
  // Verify the user can post as system
  const canPost = await canPostAsSystem(postedByUserId);
  if (!canPost) {
    throw new Error("You don't have permission to post as VeggaSystem");
  }

  // Create the pulse (conversation)
  const conversation = await db.conversation.create({
    data: {
      userId: SYSTEM_ACCOUNT.id,
      title,
      type: "PUBLIC_THREAD",
      visibility: "PUBLIC",
      tags: ["system", ...tags],
      replyPermission: "EVERYONE",
    },
  });

  // Create the first message (the actual content)
  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderId: SYSTEM_ACCOUNT.id,
      content,
    },
  });

  // Notify all users about the system update
  const notificationCount = await notifyAllUsersAboutSystemUpdate(
    conversation.id,
    title
  );

  return {
    conversationId: conversation.id,
    notificationCount,
  };
}

// Notify all users about a system update
async function notifyAllUsersAboutSystemUpdate(
  conversationId: string,
  title: string
): Promise<number> {
  // Get all users except the system account
  const users = await db.user.findMany({
    where: {
      id: { not: SYSTEM_ACCOUNT.id },
    },
    select: { id: true },
  });

  // Create notifications in batches for performance
  const batchSize = 100;
  let notified = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    await db.notification.createMany({
      data: batch.map((user) => ({
        userId: user.id,
        type: "MILESTONE", // Using milestone type for system announcements
        title: "🚀 New Update from VeggaSystem",
        message: title,
        emoji: "🚀",
        preview: `Check out the latest update: ${title.slice(0, 50)}...`,
        actorId: SYSTEM_ACCOUNT.id,
        conversationId,
        groupKey: `system-update:${conversationId}`,
      })),
    });

    notified += batch.length;
  }

  return notified;
}

// Get system account profile data
export async function getSystemAccountProfile() {
  await ensureSystemAccount();
  
  const user = await db.user.findUnique({
    where: { id: SYSTEM_ACCOUNT.id },
    include: {
      Conversation: {
        where: {
          type: "PUBLIC_THREAD",
          visibility: "PUBLIC",
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          Message: {
            take: 1,
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: {
              Pulse: true,
              ConversationView: true,
            },
          },
        },
      },
      _count: {
        select: {
          followers: true,
          Conversation: true,
        },
      },
    },
  });

  return user;
}

// Format a changelog entry for display
export function formatChangelogContent(changes: string[]): string {
  const header = `# 🚀 Platform Update\n\n`;
  const timestamp = `*Posted on ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}*\n\n---\n\n`;
  
  const body = changes.map((change, i) => `${i + 1}. ${change}`).join("\n");
  
  const footer = `\n\n---\n\n*Stay tuned for more updates! 💚*`;

  return header + timestamp + body + footer;
}
