import "server-only";

import { dbPrisma } from "@/lib/db";
import {
  AiProviderId,
  decryptApiKey,
  encryptApiKey,
  fingerprintApiKey,
  maskApiKey,
  normalizeProvider,
  sanitizeApiKey,
} from "@/lib/ai-key-crypto";

const prisma = dbPrisma as any;

export interface UserAiKeyMeta {
  provider: AiProviderId;
  isDefault: boolean;
  keyFingerprint: string;
  maskedKey: string;
  updatedAt: Date;
  createdAt: Date;
}

export async function listUserAiKeyMeta(userId: string): Promise<UserAiKeyMeta[]> {
  const rows = await prisma.userAiApiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      provider: true,
      isDefault: true,
      keyFingerprint: true,
      updatedAt: true,
      createdAt: true,
      encryptedKey: true,
      iv: true,
      authTag: true,
    },
  });

  return rows.map((row: any) => ({
    provider: normalizeProvider(row.provider),
    isDefault: row.isDefault,
    keyFingerprint: row.keyFingerprint,
    maskedKey: maskApiKey(decryptApiKey(row)),
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  }));
}

export async function upsertUserAiKey(input: {
  userId: string;
  provider: AiProviderId;
  apiKey: string;
  setDefault?: boolean;
}) {
  const userId = input.userId;
  const provider = normalizeProvider(input.provider);
  const apiKey = sanitizeApiKey(input.apiKey);

  if (!apiKey) {
    throw new Error("API key is required.");
  }

  const encrypted = encryptApiKey(apiKey);
  const keyFingerprint = fingerprintApiKey(apiKey);
  const shouldSetDefault = input.setDefault ?? true;

  if (shouldSetDefault) {
    await prisma.userAiApiKey.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.userAiApiKey.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    create: {
      userId,
      provider,
      encryptedKey: encrypted.encryptedKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyFingerprint,
      isDefault: shouldSetDefault,
    },
    update: {
      encryptedKey: encrypted.encryptedKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyFingerprint,
      isDefault: shouldSetDefault,
    },
  });
}

export async function deleteUserAiKey(userId: string, providerInput: string) {
  const provider = normalizeProvider(providerInput);

  const existing = await prisma.userAiApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { isDefault: true },
  });

  if (!existing) {
    return { deleted: false };
  }

  await prisma.userAiApiKey.delete({
    where: { userId_provider: { userId, provider } },
  });

  if (existing.isDefault) {
    const next = await prisma.userAiApiKey.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { provider: true },
    });

    if (next?.provider) {
      await prisma.userAiApiKey.update({
        where: { userId_provider: { userId, provider: next.provider } },
        data: { isDefault: true },
      });
    }
  }

  return { deleted: true };
}

export async function setDefaultUserAiProvider(userId: string, providerInput: string) {
  const provider = normalizeProvider(providerInput);

  const existing = await prisma.userAiApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { provider: true },
  });

  if (!existing) {
    throw new Error("Saved key not found for that provider.");
  }

  await prisma.userAiApiKey.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });

  await prisma.userAiApiKey.update({
    where: { userId_provider: { userId, provider } },
    data: { isDefault: true },
  });
}

export async function getUserAiKeyForGeneration(input: {
  userId: string;
  provider?: string;
}): Promise<{ provider: AiProviderId; apiKey: string } | null> {
  const preferredProvider = input.provider ? normalizeProvider(input.provider) : null;

  const preferred = preferredProvider
    ? await prisma.userAiApiKey.findUnique({
        where: { userId_provider: { userId: input.userId, provider: preferredProvider } },
        select: {
          provider: true,
          encryptedKey: true,
          iv: true,
          authTag: true,
        },
      })
    : null;

  if (preferred) {
    return {
      provider: normalizeProvider(preferred.provider),
      apiKey: decryptApiKey(preferred),
    };
  }

  const fallback = await prisma.userAiApiKey.findFirst({
    where: { userId: input.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      provider: true,
      encryptedKey: true,
      iv: true,
      authTag: true,
    },
  });

  if (!fallback) {
    return null;
  }

  return {
    provider: normalizeProvider(fallback.provider),
    apiKey: decryptApiKey(fallback),
  };
}
