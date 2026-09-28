import { z } from 'zod';

const webUrl = z.string().url().max(2048).refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}, 'Use an HTTPS URL without credentials.');
export const adminCompanyFields = ['name', 'description', 'websiteUrl', 'logo', 'bannerImage', 'colorScheme', 'usesShipping'] as const;
export const adminCompanyPatchSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  reason: z.string().trim().min(3, 'Add a short reason for the audit record.').max(500),
  name: z.string().trim().min(1, 'Enter a company name.').max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  websiteUrl: webUrl.nullable().optional(),
  logo: z.array(webUrl).max(5, 'Use at most five logo URLs.').optional(),
  bannerImage: z.array(webUrl).max(5, 'Use at most five banner URLs.').optional(),
  colorScheme: z.string().trim().max(100).nullable().optional(),
  usesShipping: z.boolean().optional(),
}).strict();
export const adminCompanyQuerySchema = z.object({
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();
export type CompanyCheckoutCounts = { livePaid: number; liveAdjusted: number; liveReview: number; sandbox: number };
export interface AdminCompany {
  id: string; name: string; orgNumber: string | null; orgType: string | null; createdAt: string;
  User_Company_ownerIdToUser: { id: string; name: string | null };
  _count: { Employee: number; Product: number; Sale: number; WarehouseLocation?: number };
  checkoutCounts: CompanyCheckoutCounts;
}
export interface AdminCompanyDetail extends AdminCompany {
  description: string | null; websiteUrl: string | null; logo: string[]; bannerImage: string[];
  colorScheme: string | null; usesShipping: boolean; updatedAt: string; employmentNoticeDays: number;
  User_Company_creatorIdToUser: { id: string; name: string | null };
  orgVerification: { status: string; verifiedAt: string | null } | null;
}
export type AdminCompanyPage = { companies: AdminCompany[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
