import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { CompanyDetailsResponseSchema } from '@/lib/types/company';
import { MyLibUserAuth } from '@/lib/user-auth';
import { resolveVisibleEmail } from '@/lib/email-visibility';

const isDev = process.env.NODE_ENV !== 'production';

type CompanyParams = { companyId?: string; companyid?: string };

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length) return Number(value);
  return Number(value);
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<CompanyParams> }
) {
  try {
    const viewer = await MyLibUserAuth();
    const resolvedParams = await params;
    const companyId = resolvedParams.companyId ?? resolvedParams.companyid;
    console.log('Fetching details for company ID:', companyId);

    if (!companyId) {
      console.error('Invalid request parameters:', { companyId });
      return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
    }

    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      include: {
        User_Company_creatorIdToUser: true,
        User_Company_ownerIdToUser: true,
        Employee: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                emailDisplayMode: true,
                image: true,
              },
            },
          },
        },
        WarehouseLocation: {
          include: {
            Inventory: {
              include: {
                Product: true,
              },
            },
          },
        },
        // ✅ NEW: include wallets so checkout can find a default receiver
        Wallet: {
          orderBy: { isDefault: 'desc' },
        },
      },
    });

    if (!company) {
      console.error('Company not found for ID:', companyId);
      return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    }

    const toRecordOrUndefined = (val: unknown): Record<string, unknown> | undefined => {
      if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
      return val as Record<string, unknown>;
    };

    const creatorUser = (company as any).User_Company_creatorIdToUser as any | null | undefined;
    const ownerUser = (company as any).User_Company_ownerIdToUser as any | null | undefined;

    const employees = Array.isArray((company as any).Employee)
      ? (company as any).Employee.map((employee: any) => ({
          id: String(employee.id),
          userId: String(employee.userId),
          role: employee.role,
          jobTitle: employee.jobTitle ?? null,
          createdAt: toIsoString(employee.createdAt),
          updatedAt: toIsoString(employee.updatedAt ?? employee.createdAt),
          user: {
            id: String(employee?.User?.id ?? employee.userId),
            name: employee?.User?.name ?? null,
            email: resolveVisibleEmail({
              targetUserId: String(employee?.User?.id ?? employee.userId),
              targetEmail: employee?.User?.email ?? null,
              targetEmailDisplayMode: employee?.User?.emailDisplayMode,
              viewerUserId: viewer?.id,
              viewerRole: viewer?.role,
            }),
            image: employee?.User?.image ?? null,
          },
          permissions: toRecordOrUndefined(employee.permissions) ?? {},
        }))
      : [];

    const warehouseLocations = Array.isArray((company as any).WarehouseLocation)
      ? (company as any).WarehouseLocation.map((warehouse: any) => ({
          id: String(warehouse.id),
          address: warehouse.address ?? null,
          city: warehouse.city ?? null,
          country: warehouse.country ?? null,
          postalCode: warehouse.postalCode ?? null,
          inventory: Array.isArray(warehouse.Inventory)
            ? warehouse.Inventory.map((inv: any) => ({
                id: inv?.id ? String(inv.id) : undefined,
                quantity: typeof inv?.quantity === 'number' ? inv.quantity : undefined,
                stock: typeof inv?.stock === 'number' ? inv.stock : undefined,
                product: inv?.Product
                  ? {
                      id: String(inv.Product.id),
                      title: String(inv.Product.title),
                      price: toNumber(inv.Product.price),
                      image: Array.isArray(inv.Product.image) ? inv.Product.image : [],
                      category: inv.Product.category ?? null,
                    }
                  : undefined,
              }))
            : undefined,
        }))
      : undefined;

    const wallets = Array.isArray((company as any).Wallet)
      ? (company as any).Wallet.map((wallet: any) => ({
          id: String(wallet.id),
          label: String(wallet.label),
          family: wallet.family,
          chainId: wallet.chainId ?? null,
          solanaCluster: wallet.solanaCluster ?? null,
          address: String(wallet.address),
          isDefault: Boolean(wallet.isDefault),
          ownerUserId: wallet.ownerUserId ?? null,
          ownerCompanyId: wallet.ownerCompanyId ?? null,
          createdAt: toIsoString(wallet.createdAt),
          updatedAt: toIsoString(wallet.updatedAt),
          verifiedAt: wallet.verifiedAt ? toIsoString(wallet.verifiedAt) : null,
        }))
      : undefined;

    const dto = {
      id: String(company.id),
      name: String(company.name),
      description: (company as any).description ?? null,
      websiteUrl: (company as any).websiteUrl ?? null,
      logo: (company as any).logo ?? null,
      bannerImage: (company as any).bannerImage ?? null,

      colorScheme: (company as any).colorScheme ?? null,
      usesShipping: Boolean((company as any).usesShipping),
      createdAt: toIsoString((company as any).createdAt),
      updatedAt: toIsoString((company as any).updatedAt),

      ownerId: String((company as any).ownerId),
      creatorId: String((company as any).creatorId),

      orgType: (company as any).orgType ?? null,
      orgNumber: (company as any).orgNumber ?? null,
      employmentNoticeDays: (company as any).employmentNoticeDays ?? null,

      creator: creatorUser
        ? {
            id: String(creatorUser.id),
            name: creatorUser.name ?? null,
            email: resolveVisibleEmail({
              targetUserId: String(creatorUser.id),
              targetEmail: creatorUser.email ?? null,
              targetEmailDisplayMode: creatorUser.emailDisplayMode,
              viewerUserId: viewer?.id,
              viewerRole: viewer?.role,
            }),
            image: creatorUser.image ?? null,
          }
        : {
            id: String((company as any).creatorId),
            name: null,
            email: null,
            image: null,
          },
      owner: ownerUser
        ? {
            id: String(ownerUser.id),
            name: ownerUser.name ?? null,
            email: resolveVisibleEmail({
              targetUserId: String(ownerUser.id),
              targetEmail: ownerUser.email ?? null,
              targetEmailDisplayMode: ownerUser.emailDisplayMode,
              viewerUserId: viewer?.id,
              viewerRole: viewer?.role,
            }),
            image: ownerUser.image ?? null,
          }
        : {
            id: String((company as any).ownerId),
            name: null,
            email: null,
            image: null,
          },

      employees,
      warehouseLocations,
      wallets,
    };

    const parsed = CompanyDetailsResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('CompanyDetailsResponseSchema validation failed:', parsed.error);
      return NextResponse.json(
        {
          message: 'Internal Server Error',
          ...(isDev ? { issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    console.log('Successfully found company:', company.name);
    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching company details:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
