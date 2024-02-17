import { UserRole } from '@prisma/client'
import * as z from 'zod'

export const MyAuthSettingsSchema = z.object({
    name: z.string(), // /* .min(6, { message: 'Minimum 6 characters required'}), */
    isTwoFactorEnabled: z.optional(z.boolean()),
    role: z.enum([UserRole.ADMIN, UserRole.USER]),
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
    referredby: z.union([z.string().length(0), z.string().min(3)]).optional().transform(e => e === "" ? undefined : e)
    // `refferedby` is a string that can be either optional (undefined or missing),
    // empty, or min 3
})

/**
 * Product related schemas
 */

// Schema for product creation
// Define a schema for a single specification, enforcing the structure { key: string, value: string }
const SpecificationSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export const MyProductCreateSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  category: z.string().min(1, { message: "Category is required" }),
  price: z.number().min(1, { message: "Price is required" }),
  userId: z.string().min(1, { message: "User is required" }),
  stock: z.number().optional(),
  image: z.array(z.string()), // Optional, assuming array of image URLs
  specifications: z.array(SpecificationSchema).optional(), // Optional, assuming arbitrary JSON data
  shippingDetails: z.array(z.object({
    method: z.string(),
    price: z.number(),
    regions: z.array(z.string())
  })).optional(),
});

// Schema for product update (optional fields for updates)
export const MyProductUpdateSchema = MyProductCreateSchema.partial();

// Schema for product review
export const MyProductReviewSchema = z.object({
  productId: z.string().min(1, { message: "Product ID is required" }),
  authorName: z.string().min(1, { message: "Author name is required" }),
  rating: z.number().min(0).max(5, { message: "Rating must be between 0 and 5" }),
  comment: z.string().min(1, { message: "Comment is required" }),
});