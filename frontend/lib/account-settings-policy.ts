import { z } from 'zod';

export const accountSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a display name').max(100).optional(),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
  // Compatibility with an already-open form. The server never writes this field.
  role: z.enum(['USER', 'ADMIN', 'OWNER']).optional(),
  identityNameSource: z.enum(['AUTO', 'MANUAL', 'GOOGLE', 'GITHUB', 'DISCORD']).optional(),
  identityImageSource: z.enum(['AUTO', 'MANUAL', 'GOOGLE', 'GITHUB', 'DISCORD']).optional(),
  emailDisplayMode: z.enum(['PRIMARY', 'HIDE']).optional(),
  password: z.union([z.literal(''), z.string().max(1024)]).optional(),
  newPassword: z.union([z.literal(''), z.string().min(8, 'Use at least 8 characters').max(72)
    .refine(value => new TextEncoder().encode(value).length <= 72, 'Use at most 72 bytes')]).optional(),
  isTwoFactorEnabled: z.boolean().optional(),
  expectedTwoFactorEnabled: z.boolean().optional(),
  securityCode: z.union([z.literal(''), z.string().regex(/^\d{6}$/, 'Enter the six-digit code')]).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.newPassword && !value.password) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Enter your current password' });
  if (value.isTwoFactorEnabled !== undefined && value.expectedTwoFactorEnabled === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['isTwoFactorEnabled'], message: 'Reload Security before changing this setting' });
});
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
export type AccountSettingsResult = { error: string } | { success: string; signInRequired?: boolean } | { twoFactor: true };
