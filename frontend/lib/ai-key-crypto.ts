import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const AI_PROVIDER_VALUES = ["OPENAI", "OPENROUTER", "ANTHROPIC", "GOOGLE", "GROK"] as const;

export type AiProviderId = (typeof AI_PROVIDER_VALUES)[number];

const ENCRYPTION_ENV_KEYS = ["BYOK_ENCRYPTION_KEY", "AI_KEYS_ENCRYPTION_KEY"] as const;

function getEncryptionKey(): Buffer {
  const secret = ENCRYPTION_ENV_KEYS.map((key) => process.env[key]).find(Boolean)?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "BYOK key storage is not configured. Set BYOK_ENCRYPTION_KEY (min 32 chars)."
    );
  }

  return createHash("sha256").update(secret).digest();
}

export function normalizeProvider(input: unknown): AiProviderId {
  if (typeof input !== "string") {
    return "OPENAI";
  }

  const value = input.trim().toUpperCase();
  if (AI_PROVIDER_VALUES.includes(value as AiProviderId)) {
    return value as AiProviderId;
  }

  return "OPENAI";
}

export function sanitizeApiKey(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function maskApiKey(apiKey: string): string {
  const clean = sanitizeApiKey(apiKey);
  if (clean.length <= 8) {
    return "••••";
  }

  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

export function fingerprintApiKey(apiKey: string): string {
  return createHash("sha256").update(sanitizeApiKey(apiKey)).digest("hex").slice(0, 16);
}

export function encryptApiKey(apiKey: string): { encryptedKey: string; iv: string; authTag: string } {
  const clean = sanitizeApiKey(apiKey);
  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptApiKey(payload: {
  encryptedKey: string;
  iv: string;
  authTag: string;
}): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "base64");
  const encrypted = Buffer.from(payload.encryptedKey, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
