import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const PhoneSendSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().min(1),
    expiresAt: IsoDateStringSchema,
    provider: z.string().min(1),
    phoneNumber: z.string().min(1),
  })
  .strict();

export const PhoneSendErrorResponseSchema = z
  .object({
    error: z.string().min(1),
    message: z.string().optional(),
    retryAfter: z.number().int().positive().optional(),
  })
  .strict();

export const PhoneSendResponseSchema = z.union([
  PhoneSendSuccessResponseSchema,
  PhoneSendErrorResponseSchema,
]);

export const PhoneVerifySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().min(1),
    phoneVerified: z.literal(true),
    verificationTier: z.string().nullable().optional(),
    verificationScore: z.number().nullable().optional(),
  })
  .strict();

export const PhoneVerifyErrorResponseSchema = z
  .object({
    error: z.string().min(1),
    message: z.string().optional(),
    attemptsRemaining: z.number().int().nonnegative().optional(),
  })
  .strict();

export const PhoneVerifyResponseSchema = z.union([
  PhoneVerifySuccessResponseSchema,
  PhoneVerifyErrorResponseSchema,
]);
