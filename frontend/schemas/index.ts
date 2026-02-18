import { EmployeeRole, UserRole } from '@/generated/prisma/browser'
import * as z from 'zod'

/**
 * User related schemas
*/
export const MyAuthSettingsSchema = z.object({
    name: z.string(), // /* .min(6, { message: 'Minimum 6 characters required'}), */
    isTwoFactorEnabled: z.optional(z.boolean()),
    role: z.enum([UserRole.OWNER, UserRole.ADMIN, UserRole.USER]),
    email: z.optional(z.string().email()),
    password: z.optional(z.string().min(6)),
    newPassword: z.optional(z.string().min(6)),
})

// COOL FEATURE FROM ZOD REFINE, checks the data and makes 2 or 0 inputs be filled, so you can't just fill 1 of them and also has a message to give back if errors are encountered
.refine((data) => {
    if (data.password && !data.newPassword) {
        return false;
    }

    return true;
}, {
    message: "New password is required!",
    path: ["newPassword"]
})
.refine((data) => {
    if (data.newPassword && !data.password) {
        return false;
    }

    return true;
}, {
    message: "Password is required!",
    path: ["password"]
})

// Reset schema for 'email'
export const MyAuthNewPasswordSchema = z.object({
    password: z.string().min(6, {
        message: 'Minimum 6 characters required'
    }),
})

// Reset schema for 'email'
export const MyAuthResetSchema = z.object({
    email: z.string().email({
        message: 'Email is required'
    }),
})

// Login schema for 'email' and 'password'
export const MyAuthLoginSchema = z.object({
    email: z.string().email({
        message: 'Email is required'
    }),
    password: z.string().min(1, {
        message: 'Password is required'
    }),
    code: z.optional(z.string()),
})

// Schema for magic-link login via email verification token
export const MyEmailLoginTokenSchema = z.object({
    email: z.string().email({
        message: 'Email is required'
    }),
    loginToken: z.string().min(1, {
        message: 'Login token is required'
    }),
})

export const MyAuthRegisterSchema = z.object({
    email: z.string().email({
        message: 'Email is required'
    }),
    password: z.string().min(6, {
        message: 'Minimum 6 characters required'
    }),
    name: z.string().min(1, {
        message: 'Name is required'
    }),
    referredBy: z.union([z.string().length(0), z.string().min(3)]).optional().transform(e => e === "" ? undefined : e), // `referredBy` is a string that can be either optional (undefined or missing), empty, or min 3
    image: z.string().optional(),
})

/**
 * Product related schemas
 */

// Define a schema for a single specification, enforcing the structure { key: string, value: string }
// Schema for product creation 1/4
const SpecificationSchema = z.object({
    key: z.string(),
    value: z.union([z.string(), z.number()])
});

// Feature schema - supports both simple bullet points and key-value pairs
// e.g. { text: "6 card slots" } or { key: "Slots", value: "6 card slots" }
const FeatureSchema = z.object({
    text: z.string().min(1),
    key: z.string().optional(),        // Optional category/group label
    icon: z.string().optional(),       // Optional icon identifier for future use
});

// Product condition enum values
export const ProductConditionValues = ['NEW', 'AS_NEW', 'GOOD', 'FAIR', 'POOR'] as const;
export type ProductConditionType = typeof ProductConditionValues[number];

// Fiat currency values (for product pricing + payment availability)
export const FiatCurrencyValues = ['USD', 'NOK', 'EUR', 'GBP'] as const;
export type FiatCurrencyType = typeof FiatCurrencyValues[number];

// Product type values
export const ProductTypeValues = ['PHYSICAL', 'DIGITAL', 'HYBRID'] as const;
export type ProductTypeType = typeof ProductTypeValues[number];

// Category tag schema for the new multi-category system
export const CategoryTagSchema = z.object({
    id: z.string().optional(), // For existing categories
    name: z.string().min(1, { message: 'Category name is required' }),
    slug: z.string().optional(),
    isNew: z.boolean().optional(), // True if creating a new category
    parentId: z.string().nullable().optional(),
    parentName: z.string().nullable().optional(),
});
export type CategoryTag = z.infer<typeof CategoryTagSchema>;

// Schema for product creation 2/4
export const AcceptedTokenSchema = z.object({
    family: z.enum(['EVM', 'SOLANA']),
    symbol: z.string().min(1).max(20),
    decimals: z.number().int().min(0).max(18),
    tokenAddress: z.string().optional().nullable(),
    tokenMint: z.string().optional().nullable(),
});
export type AcceptedToken = z.infer<typeof AcceptedTokenSchema>;

export const MyProductCreateSchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    description: z.string().min(1, { message: "Description is required" }),
    // Legacy single category - kept for backward compatibility
    category: z.string().min(1, { message: "Category is required" }),
    // New multi-category system - array of category tags
    categories: z.array(CategoryTagSchema).optional().default([]),
    price: z.number().min(0, { message: "Price must be 0 or greater" }),
    priceCurrency: z.enum(FiatCurrencyValues).default('USD'),
    acceptedFiatCurrencies: z.array(z.enum(FiatCurrencyValues)).default([]),
    condition: z.enum(ProductConditionValues).default('NEW'),
    userId: z.string().min(1, { message: "User is required" }),
    companyId: z.string().optional(),
    stock: z.number().optional(),
    shipFromPostalId: z.string().optional(),
    image: z.array(z.string()).default([]), // Optional, array of image URLs
    quantity: z.number().min(1, { message: 'Quantity must be at least 1' }),
    isPhysicalProduct: z.boolean().optional(),
    specifications: z.array(SpecificationSchema).optional(), // Optional, assuming arbitrary JSON data
    features: z.array(FeatureSchema).max(50).optional(),     // Product features/highlights
    shippingDetails: z.array(z.object({
        method: z.string(),
        price: z.number(),
        regions: z.array(z.string())
    })).optional(),
    
    // Digital product fields
    productType: z.enum(ProductTypeValues).default('PHYSICAL'),
    digitalAssetId: z.string().optional(), // Reference to uploaded digital asset
    downloadsEnabled: z.boolean().default(true),
    maxDownloads: z.number().int().positive().optional().nullable(), // null = unlimited
    downloadExpiryDays: z.number().int().positive().optional().nullable(), // null = never expires
    
    // Shipping options
    freeShippingEnabled: z.boolean().default(false),
    freeShippingThreshold: z.number().min(0).optional().nullable(), // null = no threshold (always free)

    // Crypto payment: accepted tokens for this product
    acceptedTokens: z.array(AcceptedTokenSchema).optional().default([]),
    receiverWalletId: z.string().optional().nullable(),
});

// Schema for product update (optional fields for updates) 3/4
export const MyProductUpdateSchema = MyProductCreateSchema.partial();

// Schema for product review 4/4
export const MyProductReviewSchema = z.object({
    productId: z.string().min(1, { message: "Product ID is required" }),
    authorName: z.string().min(1, { message: "Author name is required" }),
    rating: z.number().min(0).max(5, { message: "Rating must be between 0 and 5" }),
    comment: z.string().min(1, { message: "Comment is required" }),
});

// new company?
// Define the schema for employee
export const employeePermissionsSchema = z.object({
    // Employee Management
    CAN_ADD_EMPLOYEE: z.boolean().default(false),
    CAN_REMOVE_EMPLOYEE: z.boolean().default(false),
    CAN_EDIT_EMPLOYEE_ROLE: z.boolean().default(false),
    CAN_EDIT_PERMISSION: z.boolean().default(false),
    
    // Company Management
    CAN_DELETE_COMPANY: z.boolean().default(false),
    CAN_EDIT_COMPANY_DETAILS: z.boolean().default(false),
    CAN_MANAGE_WAREHOUSES: z.boolean().default(false),
    
    // Product Management - General (legacy, applies to all product types)
    CAN_POST_PRODUCT_POSITION_PERMISSION: z.boolean().default(false),
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: z.boolean().default(false),
    CAN_DELETE_PRODUCT: z.boolean().default(false),
    CAN_VIEW_ANALYTICS: z.boolean().default(false),
    
    // Physical Products - Specific permissions
    CAN_CREATE_PHYSICAL_PRODUCT: z.boolean().default(false),
    CAN_EDIT_PHYSICAL_PRODUCT: z.boolean().default(false),
    CAN_DELETE_PHYSICAL_PRODUCT: z.boolean().default(false),
    
    // Digital Products - Specific permissions
    CAN_CREATE_DIGITAL_PRODUCT: z.boolean().default(false),
    CAN_EDIT_DIGITAL_PRODUCT: z.boolean().default(false),
    CAN_DELETE_DIGITAL_PRODUCT: z.boolean().default(false),
    CAN_UPLOAD_DIGITAL_ASSETS: z.boolean().default(false),
    CAN_MANAGE_DOWNLOAD_SETTINGS: z.boolean().default(false),
    CAN_VIEW_DOWNLOAD_STATS: z.boolean().default(false),
    CAN_REVOKE_DOWNLOAD_TOKENS: z.boolean().default(false),
    
    // Field-level edit permissions (granular control)
    CAN_EDIT_PRODUCT_TITLE: z.boolean().default(false),
    CAN_EDIT_PRODUCT_DESCRIPTION: z.boolean().default(false),
    CAN_EDIT_PRODUCT_PRICE: z.boolean().default(false),
    CAN_EDIT_PRODUCT_IMAGES: z.boolean().default(false),
    CAN_EDIT_PRODUCT_STOCK: z.boolean().default(false),
    CAN_EDIT_PRODUCT_CATEGORY: z.boolean().default(false),
    CAN_EDIT_ACCEPTED_PAYMENTS: z.boolean().default(false),
    CAN_EDIT_SHIPPING_SETTINGS: z.boolean().default(false),
    
    // Financial
    CAN_VIEW_SALES: z.boolean().default(false),
    CAN_MANAGE_PRICING: z.boolean().default(false),
    CAN_PROCESS_REFUNDS: z.boolean().default(false),

    // Tax Helper
    CAN_VIEW_TAX_REPORTS: z.boolean().default(false),
    CAN_EDIT_TAX_DATA: z.boolean().default(false),
    CAN_MANAGE_EXPENSES: z.boolean().default(false),
    CAN_MANAGE_SALARIES: z.boolean().default(false),
    CAN_COMMENT_TAX_REPORTS: z.boolean().default(false),

    // Warehouse & Fulfilment
    CAN_VIEW_ORDERS: z.boolean().default(false),
    CAN_PROCESS_ORDERS: z.boolean().default(false),
    CAN_SHIP_ORDERS: z.boolean().default(false),
    CAN_MANAGE_SHIPMENTS: z.boolean().default(false),
    CAN_VIEW_INVENTORY: z.boolean().default(false),
    CAN_EDIT_INVENTORY: z.boolean().default(false),
});
export const employeeSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    //name: z.string().min(1, 'Name is required'),
    role: z.enum([EmployeeRole.OWNER, EmployeeRole.MANAGER, EmployeeRole.STAFF, EmployeeRole.WAREHOUSE_MANAGER, EmployeeRole.WAREHOUSE_WORKER, EmployeeRole.ACCOUNTANT, EmployeeRole.USER]),
    jobTitle: z.string().trim().min(1).max(80).optional(),
    permissions: employeePermissionsSchema.optional(), // permissions: z.array(z.string()).optional(), // Assuming permissions is an array of strings, adjust as necessary
});
// Define the schema for shipping logistic and tracking information
export const baseWarehouseLocationSchema = z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    // companyId: z.string().optional(), // not sure about this yet...
});

// Define the company schema with conditional logic for warehouseLocations
export const companyCreationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    websiteUrl: z.string().url().optional(),
    logo: z.array(z.string()), // z.string().url().optional(),
    bannerImage: z.array(z.string()), // z.string().url().optional(),
    colorScheme: z.string().optional(),

    // Registration / company metadata (optional)
    orgType: z.preprocess(
        (v) => {
            if (v == null) return undefined;
            if (typeof v !== 'string') return v;
            const s = v.trim();
            if (!s || s === 'UNSPECIFIED') return undefined;
            return s;
        },
        z.enum(['ENK', 'AS', 'ANS', 'DA', 'SA', 'FORENING', 'NUF', 'OTHER']).optional()
    ),
    orgNumber: z
        .preprocess(
            (v) => {
                if (v == null) return undefined;
                if (typeof v !== 'string') return v;
                const s = v.trim();
                return s.length ? s : undefined;
            },
            z.string().optional()
        )
        .refine(
            (v) => v == null || /^\d{9}$/.test(v),
            'Organization number must be 9 digits (optional)'
        ),
    employmentNoticeDays: z
        .preprocess(
            (v) => {
                if (v == null || v === '') return undefined;
                if (typeof v === 'string') return Number(v);
                return v;
            },
            z.number().int().min(0, 'Notice days must be >= 0').max(365, 'Notice days must be <= 365').optional()
        )
        .default(14),

    creatorId: z.string(),
    ownerId: z.string(),
    employees: z.array(employeeSchema).optional(), // TODO change from any soon...
    usesShipping: z.boolean(),
    // Use a non-validated placeholder for warehouseLocations here
    warehouseLocations: z.array(baseWarehouseLocationSchema).optional(),
}).superRefine((data, ctx) => {
    // If usesShipping is true, validate each warehouseLocation with an updated schema that requires postalCode
    if (data.usesShipping === true) {
        const warehouseLocationSchemaWithPostalCode = baseWarehouseLocationSchema.extend({
            address: z.string().min(1, 'Address is required'),
            city: z.string().min(1, 'City is required'),
            country: z.string().min(1, 'Country is required'),
            postalCode: z.string().min(4, "Postal code is required"),
        });
        // If usesShipping is true, ensure there's at least one warehouseLocation
        if (!data.warehouseLocations || data.warehouseLocations.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.too_small,
                message: "At least one warehouse location is required when shipping is enabled",
                path: ["usesShipping"], // Specify where the error should be displayed
                minimum: 1,
                type: 'array',
                inclusive: true,
            });
        }

        // Validate each warehouse location
        data.warehouseLocations?.forEach((location, index) => {
            const result = warehouseLocationSchemaWithPostalCode.safeParse(location);
            if (!result.success) {
                // Add errors for each failing validation
                result.error.issues.forEach((issue) => {
                    ctx.addIssue({
                        ...issue,
                        path: ["warehouseLocations", index, ...issue.path],
                    });
                });
            }
        });
    }
    // No need to explicitly handle the case where usesShipping is false, as postalCode is optional in the base schema
});

// NEW EMPLOYEE schema
export const NewEmployeeSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    role: z.enum([EmployeeRole.OWNER, EmployeeRole.MANAGER, EmployeeRole.STAFF, EmployeeRole.USER]),
    jobTitle: z.string().trim().min(1).max(80).optional(),
    // Optionally include permissions if your application logic requires them
    permissions: z.array(z.string()).optional(),
});