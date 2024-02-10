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