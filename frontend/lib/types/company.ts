import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const CompanyListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
  })
  .strict();

export const CompanyListResponseSchema = z.array(CompanyListItemSchema);

export const CompanyUserSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().nullable().optional(),
    image: z.string().nullable(),
  })
  .strict();

export const CompanyEmployeeResponseSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    role: z.enum(['OWNER', 'MANAGER', 'STAFF', 'WAREHOUSE_MANAGER', 'WAREHOUSE_WORKER', 'ACCOUNTANT', 'USER']),
    jobTitle: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
    user: CompanyUserSummarySchema,
    permissions: z.record(z.unknown()),
  })
  .strict();

export const CompanyProductSummarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    price: z.number().finite(),
    image: z.array(z.string()),
    category: z.string().nullable().optional(),
  })
  .strict();

export const CompanyInventoryItemResponseSchema = z
  .object({
    id: z.string().min(1).optional(),
    quantity: z.number().int().finite().optional(),
    stock: z.number().int().finite().optional(),
    product: CompanyProductSummarySchema.optional(),
  })
  .strict();

export const CompanyWarehouseLocationResponseSchema = z
  .object({
    id: z.string().min(1),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    inventory: z.array(CompanyInventoryItemResponseSchema).optional(),
  })
  .strict();

export const CompanyWalletResponseSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    family: z.enum(['EVM', 'SOLANA']),
    chainId: z.number().int().nullable().optional(),
    solanaCluster: z.string().nullable().optional(),
    address: z.string().min(1),
    isDefault: z.boolean(),
    ownerUserId: z.string().nullable().optional(),
    ownerCompanyId: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
    verifiedAt: IsoDateStringSchema.nullable().optional(),
  })
  .strict();

export const CompanyDetailsResponseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    websiteUrl: z.string().nullable().optional(),
    logo: z.array(z.string()).nullable(),
    bannerImage: z.array(z.string()).nullable(),

    colorScheme: z.string().nullable().optional(),
    usesShipping: z.boolean(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,

    ownerId: z.string().min(1),
    creatorId: z.string().min(1),

    orgType: z.enum(['ENK', 'AS', 'ANS', 'DA', 'SA', 'FORENING', 'NUF', 'OTHER']).nullable().optional(),
    orgNumber: z.string().nullable().optional(),
    employmentNoticeDays: z.number().int().finite().nullable().optional(),

    creator: CompanyUserSummarySchema,
    owner: CompanyUserSummarySchema,

    employees: z.array(CompanyEmployeeResponseSchema),
    warehouseLocations: z.array(CompanyWarehouseLocationResponseSchema).optional(),
    wallets: z.array(CompanyWalletResponseSchema).optional(),
  })
  .strict();

export const CompanyPublicCreatorSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
  })
  .strict();

export const CompanyEmployeesCountSchema = z
  .object({
    employees: z.number().int().finite(),
  })
  .strict();

export const CompanyPublicListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    logo: z.array(z.string()).nullable(),
    bannerImage: z.array(z.string()).nullable(),
    orgType: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    creator: CompanyPublicCreatorSchema,
    _count: CompanyEmployeesCountSchema,
  })
  .strict();

export const CompaniesPublicResponseSchema = z.array(CompanyPublicListItemSchema);

export const CompanyEmployeeSlimSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    role: z.enum(['OWNER', 'MANAGER', 'STAFF', 'WAREHOUSE_MANAGER', 'WAREHOUSE_WORKER', 'ACCOUNTANT', 'USER']),
    permissions: z.record(z.unknown()).optional(),
    createdAt: IsoDateStringSchema,
  })
  .strict();

export const CompanyByUserRelationListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    logo: z.array(z.string()).nullable(),
    bannerImage: z.array(z.string()).nullable(),
    orgType: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    ownerId: z.string().min(1),
    creatorId: z.string().min(1),
    _count: CompanyEmployeesCountSchema,
    employees: z.array(CompanyEmployeeSlimSchema),
  })
  .strict();

export const CompaniesByUserRelationResponseSchema = z.array(CompanyByUserRelationListItemSchema);

export const CompanyCreateResponseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    websiteUrl: z.string().nullable().optional(),
    logo: z.array(z.string()),
    bannerImage: z.array(z.string()),
    colorScheme: z.string().nullable().optional(),
    usesShipping: z.boolean(),
    ownerId: z.string().min(1),
    creatorId: z.string().min(1),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export const CompanyDeleteResponseSchema = z
  .object({
    success: z.string().min(1),
  })
  .strict();

export const CompanyEmployeePermissionsPatchResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export const CompanyEmployeeRemoveResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export const CompanyRegistrationPatchResponseSchema = z
  .object({
    success: z.literal(true),
    company: z
      .object({
        id: z.string().min(1),
        orgType: z.string().nullable().optional(),
        orgNumber: z.string().nullable().optional(),
        employmentNoticeDays: z.number().int().finite().nullable().optional(),
      })
      .strict(),
  })
  .strict();

export const CompanyWarehouseStockItemSchema = z
  .object({
    id: z.string().min(1),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    initialStock: z.number().int().finite(),
    currentStock: z.number().int().finite(),
  })
  .strict();

export const CompanyWarehouseStockResponseSchema = z
  .object({
    warehouses: z.array(CompanyWarehouseStockItemSchema),
  })
  .strict();

export const CompanyWarehouseProductSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    price: z.number().finite(),
    stock: z.number().int().finite(),
    shipFromPostalId: z.string().min(1),
    image: z.array(z.string()),
    specifications: z.record(z.unknown()).optional(),
    userId: z.string().min(1),
    companyId: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export const CompanyWarehouseInventoryItemSchema = z
  .object({
    id: z.string().min(1),
    quantity: z.number().int().finite(),
    stock: z.number().int().finite(),
    warehouseId: z.string().min(1),
    productId: z.string().min(1),
    product: CompanyWarehouseProductSchema,
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export const CompanyWarehouseDetailsResponseSchema = z
  .object({
    id: z.string().min(1),
    companyId: z.string().min(1),
    postalCode: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    latitude: z.number().finite().nullable().optional(),
    longitude: z.number().finite().nullable().optional(),
    inventory: z.array(CompanyWarehouseInventoryItemSchema),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export type CompanyUserSummary = z.infer<typeof CompanyUserSummarySchema>;
export type CompanyEmployeeResponse = z.infer<typeof CompanyEmployeeResponseSchema>;
export type CompanyInventoryItemResponse = z.infer<typeof CompanyInventoryItemResponseSchema>;
export type CompanyWarehouseLocationResponse = z.infer<typeof CompanyWarehouseLocationResponseSchema>;
export type CompanyWalletResponse = z.infer<typeof CompanyWalletResponseSchema>;
export type CompanyDetailsResponse = z.infer<typeof CompanyDetailsResponseSchema>;

export type CompanyListItem = z.infer<typeof CompanyListItemSchema>;
export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;

export type CompanyPublicListItem = z.infer<typeof CompanyPublicListItemSchema>;
export type CompaniesPublicResponse = z.infer<typeof CompaniesPublicResponseSchema>;

export type CompanyEmployeeSlim = z.infer<typeof CompanyEmployeeSlimSchema>;
export type CompaniesByUserRelationResponse = z.infer<typeof CompaniesByUserRelationResponseSchema>;

export type CompanyCreateResponse = z.infer<typeof CompanyCreateResponseSchema>;
export type CompanyRegistrationPatchResponse = z.infer<typeof CompanyRegistrationPatchResponseSchema>;

export type CompanyWarehouseStockResponse = z.infer<typeof CompanyWarehouseStockResponseSchema>;
export type CompanyWarehouseDetailsResponse = z.infer<typeof CompanyWarehouseDetailsResponseSchema>;
