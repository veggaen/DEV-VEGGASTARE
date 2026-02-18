/**
 * @fileOverview Runtime integration toggles with env defaults and DB overrides.
 * @stability stable
 */

import { dbPrisma } from '@/lib/db';

export type RuntimeConfigSnapshot = {
  paymentsLiveEnabled: boolean;
  bringLiveEnabled: boolean;
  updatedBy: string | null;
  updatedAt: Date;
};

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

export function defaultPaymentsLiveEnabled(): boolean {
  const explicit = parseBooleanEnv(process.env.PAYMENTS_LIVE_ENABLED);
  if (explicit !== null) return explicit;
  return process.env.NODE_ENV === 'production';
}

export function defaultBringLiveEnabled(): boolean {
  const explicit = parseBooleanEnv(process.env.BRING_LIVE_ENABLED);
  if (explicit !== null) return explicit;

  const bringMode = (process.env.BRING_MODE ?? '').trim().toLowerCase();
  if (bringMode === 'live') return true;
  if (bringMode === 'mock' || bringMode === 'test') return false;

  const testMode = parseBooleanEnv(process.env.BRING_TEST_MODE);
  if (testMode !== null) return !testMode;

  return process.env.NODE_ENV === 'production';
}

export async function getRuntimeConfig(): Promise<RuntimeConfigSnapshot> {
  const runtime = await dbPrisma.runtimeConfig.findUnique({
    where: { singletonKey: 'default' },
    select: {
      paymentsLiveEnabled: true,
      bringLiveEnabled: true,
      updatedBy: true,
      updatedAt: true,
    },
  });

  if (!runtime) {
    return {
      paymentsLiveEnabled: defaultPaymentsLiveEnabled(),
      bringLiveEnabled: defaultBringLiveEnabled(),
      updatedBy: null,
      updatedAt: new Date(0),
    };
  }

  return runtime;
}

export async function upsertRuntimeConfig(input: {
  paymentsLiveEnabled?: boolean;
  bringLiveEnabled?: boolean;
  updatedBy: string;
}): Promise<RuntimeConfigSnapshot> {
  const current = await getRuntimeConfig();

  const paymentsLiveEnabled = input.paymentsLiveEnabled ?? current.paymentsLiveEnabled;
  const bringLiveEnabled = input.bringLiveEnabled ?? current.bringLiveEnabled;

  return dbPrisma.runtimeConfig.upsert({
    where: { singletonKey: 'default' },
    create: {
      singletonKey: 'default',
      paymentsLiveEnabled,
      bringLiveEnabled,
      updatedBy: input.updatedBy,
    },
    update: {
      paymentsLiveEnabled,
      bringLiveEnabled,
      updatedBy: input.updatedBy,
    },
    select: {
      paymentsLiveEnabled: true,
      bringLiveEnabled: true,
      updatedBy: true,
      updatedAt: true,
    },
  });
}
