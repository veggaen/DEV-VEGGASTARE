/**
 * @fileOverview Norway organization lookup helpers (Brønnøysundregisteret).
 * @stability beta
 */

import { CompanyOrgType } from '@/generated/prisma/browser';

export interface NorwayOrgLookupAddress {
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface NorwayOrgLookupResult {
  found: boolean;
  orgNumber: string;
  legalName?: string;
  orgFormCode?: string;
  orgFormLabel?: string;
  suggestedOrgType?: CompanyOrgType;
  websiteUrl?: string;
  officialEmail?: string;
  address?: NorwayOrgLookupAddress;
  sourceUrl?: string;
  message?: string;
}

export interface NorwayOrgSuggestion {
  orgNumber: string;
  legalName: string;
  orgFormCode?: string;
  orgFormLabel?: string;
  suggestedOrgType?: CompanyOrgType;
  officialEmail?: string;
  websiteUrl?: string;
}

export function normalizeNorwegianOrgNumber(input?: string | null): string {
  if (!input) return '';
  return input.replace(/\D/g, '').slice(0, 9);
}

export function formatNorwegianOrgNumber(input?: string | null): string {
  const digits = normalizeNorwegianOrgNumber(input);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function mapBrregOrgType(code?: string | null, label?: string | null): CompanyOrgType | undefined {
  const c = (code || '').toUpperCase();
  const l = (label || '').toUpperCase();

  if (c.includes('ENK') || l.includes('ENKELTPERSON')) return 'ENK';
  if (c === 'AS' || l.includes('AKSJESELSKAP')) return 'AS';
  if (c === 'ANS' || l.includes('ANSVARLIG SELSKAP')) return 'ANS';
  if (c === 'DA' || l.includes('DELT ANSVAR')) return 'DA';
  if (c === 'SA' || l.includes('SAMVIRKE')) return 'SA';
  if (c.includes('FOREN') || l.includes('FORENING')) return 'FORENING';
  if (c === 'NUF' || l.includes('NUF')) return 'NUF';

  return undefined;
}

function pickOfficialEmail(payload: Record<string, any>): string | undefined {
  const candidates = [
    payload.epostadresse,
    payload.ePostadresse,
    payload.kontaktinformasjon?.epost,
    payload.kontaktinformasjon?.epostadresse,
    payload.kontaktinformasjon?.email,
    payload.kontaktinformasjon?.ePostadresse,
  ];

  const email = candidates.find((v) => typeof v === 'string' && v.includes('@'));
  return email?.trim();
}

function pickAddress(payload: Record<string, any>): NorwayOrgLookupAddress | undefined {
  const addr = payload.forretningsadresse ?? payload.postadresse ?? payload.beliggenhetsadresse;
  if (!addr || typeof addr !== 'object') return undefined;

  const line = Array.isArray(addr.adresse) ? addr.adresse.filter(Boolean).join(', ') : undefined;

  return {
    address: line,
    postalCode: addr.postnummer || undefined,
    city: addr.poststed || undefined,
    country: addr.land || 'NO',
  };
}

export async function lookupNorwegianOrganization(orgNumberRaw: string): Promise<NorwayOrgLookupResult> {
  const orgNumber = normalizeNorwegianOrgNumber(orgNumberRaw);

  if (!/^\d{9}$/.test(orgNumber)) {
    return {
      found: false,
      orgNumber,
      message: 'Organization number must be exactly 9 digits',
    };
  }

  const endpoint = `https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 404) {
      return {
        found: false,
        orgNumber,
        sourceUrl: endpoint,
        message: 'No registered organization found for this number',
      };
    }

    if (!res.ok) {
      return {
        found: false,
        orgNumber,
        sourceUrl: endpoint,
        message: `Lookup failed with status ${res.status}`,
      };
    }

    const payload = (await res.json()) as Record<string, any>;
    const orgFormCode = payload.organisasjonsform?.kode as string | undefined;
    const orgFormLabel = payload.organisasjonsform?.beskrivelse as string | undefined;

    return {
      found: true,
      orgNumber,
      legalName: (payload.navn as string | undefined)?.trim(),
      orgFormCode,
      orgFormLabel,
      suggestedOrgType: mapBrregOrgType(orgFormCode, orgFormLabel),
      websiteUrl: (payload.hjemmeside as string | undefined)?.trim(),
      officialEmail: pickOfficialEmail(payload),
      address: pickAddress(payload),
      sourceUrl: payload?._links?.self?.href ?? endpoint,
    };
  } catch {
    return {
      found: false,
      orgNumber,
      sourceUrl: endpoint,
      message: 'Could not reach Brønnøysund register right now',
    };
  }
}

export async function searchNorwegianOrganizationsByPrefix(
  orgPrefixRaw: string,
  limit = 6
): Promise<NorwayOrgSuggestion[]> {
  const orgPrefix = normalizeNorwegianOrgNumber(orgPrefixRaw);
  if (orgPrefix.length < 3) return [];

  const endpoint = `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${encodeURIComponent(orgPrefix)}&size=${Math.max(1, Math.min(limit, 10))}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return [];
    }

    const payload = (await res.json()) as Record<string, any>;
    const entries = Array.isArray(payload?._embedded?.enheter)
      ? payload._embedded.enheter
      : [];

    return entries
      .map((entry: Record<string, any>) => {
        const orgNumber = normalizeNorwegianOrgNumber(entry.organisasjonsnummer);
        if (!orgNumber) return null;

        const orgFormCode = entry.organisasjonsform?.kode as string | undefined;
        const orgFormLabel = entry.organisasjonsform?.beskrivelse as string | undefined;

        return {
          orgNumber,
          legalName: ((entry.navn as string | undefined) ?? '').trim(),
          orgFormCode,
          orgFormLabel,
          suggestedOrgType: mapBrregOrgType(orgFormCode, orgFormLabel),
          officialEmail: pickOfficialEmail(entry),
          websiteUrl: (entry.hjemmeside as string | undefined)?.trim(),
        } satisfies NorwayOrgSuggestion;
      })
      .filter((entry: NorwayOrgSuggestion | null): entry is NorwayOrgSuggestion => Boolean(entry))
      .filter((entry: NorwayOrgSuggestion) => entry.orgNumber.startsWith(orgPrefix))
      .slice(0, Math.max(1, Math.min(limit, 10)));
  } catch {
    return [];
  }
}
