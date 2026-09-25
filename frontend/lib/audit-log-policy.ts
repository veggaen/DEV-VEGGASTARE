import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_TARGETS } from './audit-log-view';

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const date = z.string().datetime({ offset: true });
export const auditQuery = z.union([
  z.object({ entry: id }).strict(),
  z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    action: z.enum(AUDIT_ACTIONS).optional(), targetType: z.enum(AUDIT_TARGETS).optional(),
    adminId: id.optional(), targetId: id.optional(), startDate: date.optional(), endDate: date.optional(),
  }).strict().refine(value => !value.startDate || !value.endDate || new Date(value.startDate) <= new Date(value.endDate)),
]);

/** Display-only projection; originals are not rewritten. This is defense in
 * depth, not proof that all historic free text is secret-free. */
export function auditDataForDisplay(value: unknown): unknown {
  let remaining = 8000;
  let nodes = 0;
  const text = (value: string) => {
    const maximum = Math.min(2000, remaining);
    remaining -= Math.min(value.length, maximum);
    return value.length > maximum ? value.slice(0, maximum) + '… [truncated]' : value;
  };
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 400 || remaining <= 0 || depth > 6) return '[truncated]';
    if (typeof value === 'string') return text(value);
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (Array.isArray(value)) return [...value.slice(0, 30).map(item => visit(item, depth + 1)), ...(value.length > 30 ? ['[truncated]'] : [])];
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      return Object.fromEntries([
        ...entries.slice(0, 40).map(([key, item]) => {
          const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const sensitive = /password|secret|accesstoken|refreshtoken|idtoken|authorization|cookie|apikey|privatekey|securitycode|csrf|otp/.test(normalized);
          return [text(key), sensitive ? '[redacted]' : visit(item, depth + 1)];
        }),
        ...(entries.length > 40 ? [['…', '[truncated]']] : []),
      ]);
    }
    return null;
  }
  return visit(value, 0);
}
