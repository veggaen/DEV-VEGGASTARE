import { z } from 'zod';
import { ChainFamily } from '@prisma/client';

const IsoDateStringSchema = z.string().min(1);

export const WalletDtoSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    family: z.nativeEnum(ChainFamily),
    chainId: z.number().int().positive().nullable(),
    solanaCluster: z.string().nullable(),
    address: z.string().min(1),
    isDefault: z.boolean(),
    ownerUserId: z.string().min(1).nullable(),
    ownerCompanyId: z.string().min(1).nullable(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
    verifiedAt: IsoDateStringSchema.nullable(),
  })
  .strict();

export type WalletDto = z.infer<typeof WalletDtoSchema>;

export const EvmWalletListItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    address: z.string().min(1),
    chainId: z.number().int().positive().nullable(),
    isDefault: z.boolean(),
    verifiedAt: IsoDateStringSchema.nullable(),
    createdAt: IsoDateStringSchema,
  })
  .strict();

export const EvmWalletListResponseSchema = z
  .object({
    wallets: z.array(EvmWalletListItemSchema),
  })
  .strict();

export const WalletTwoFactorResponseSchema = z
  .object({
    twoFactor: z.literal(true),
  })
  .strict();

export const WalletOkResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

export const WalletVerifyResponseSchema = z
  .object({
    ok: z.literal(true),
    wallet: WalletDtoSchema,
  })
  .strict();

export const WalletChallengeCreatedResponseSchema = z
  .object({
    challengeId: z.string().min(1),
    message: z.string().min(1),
    expires: IsoDateStringSchema,
  })
  .strict();

export const WalletErrorResponseSchema = z
  .object({
    error: z.string().min(1),
  })
  .strict();
