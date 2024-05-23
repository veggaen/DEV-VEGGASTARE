import { EmployeeRole, UserRole } from '@prisma/client'
import * as z from 'zod'

/**
 * User related schemas
*/
export const MyAuthSettingsSchema = z.object({
    name: z.string(), // /* .min(6, { message: 'Minimum 6 characters required'}), */
    isTwoFactorEnabled: z.optional(z.boolean()),
    role: z.enum([UserRole.OWNER,UserRole.ADMIN, UserRole.USER]),
    email: z.optional(z.string().email()),
    password: z.optional(z.string().min(6)),
    newPassword: z.optional(z.string().min(6)),
})

// COOL FEATURE FROM ZOD REFINE, checks the data and makes 2 or 0 inputs be filled, so you cant just fill 1 of them and also has a message to give back if errors are encountered
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
    referredBy: z.union([z.string().length(0), z.string().min(3)]).optional().transform(e => e === "" ? undefined : e)
    // `referredBy` is a string that can be either optional (undefined or missing),
    // empty, or min 3
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
// Schema for product creation 2/4
export const MyProductCreateSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  category: z.string().min(1, { message: "Category is required" }),
  price: z.number().min(1, { message: "Price is required" }),
  userId: z.string().min(1, { message: "User is required" }),
  companyId: z.string().optional(),
  stock: z.number().optional(),
  shipFromPostalId: z.string().optional(),
  image: z.array(z.string()), // Optional, assuming array of image URLs
  specifications: z.array(SpecificationSchema).optional(), // Optional, assuming arbitrary JSON data
  shippingDetails: z.array(z.object({
    method: z.string(),
    price: z.number(),
    regions: z.array(z.string())
  })).optional(),
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
  CAN_REMOVE_EMPLOYEE: z.boolean().default(false),
  CAN_EDIT_PERMISSION: z.boolean().default(false),
  CAN_DELETE_COMPANY: z.boolean().default(false),
  CAN_POST_PRODUCT_POSITION_PERMISSION: z.boolean().default(false),
  CAN_ADD_EMPLOYEE: z.boolean().default(false),
});
export const employeeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  //name: z.string().min(1, 'Name is required'),
  role: z.enum([EmployeeRole.OWNER, EmployeeRole.MANAGER, EmployeeRole.STAFF, EmployeeRole.USER]), // Assuming EmployeeRole is an enum you have defined
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
      city: z.string().min(1, 'city is required'),
      country: z.string().min(1, 'city is required'),
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

    // something..
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
 // Optionally include permissions if your application logic requires them
 permissions: z.array(z.string()).optional(),
});