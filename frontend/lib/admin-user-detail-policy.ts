import { z } from 'zod';
import { isDemoUserId } from './demo-policy';

const image = z.string().url().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}, 'Use an HTTPS image URL without credentials.').nullable().optional();

export const adminUserPatchSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  reason: z.string().trim().min(3, 'Add a short reason for the audit record.').max(500),
  name: z.string().trim().min(1, 'Enter a display name.').max(200).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  image, banner: image,
  role: z.enum(['USER', 'ADMIN']).optional(),
}).strict();

export function adminUserPermissions(actor: { id: string; role?: string }, target: { id: string; role: string }) {
  const edit = !isDemoUserId(actor.id) && !isDemoUserId(target.id) && actor.id !== target.id
    && target.role !== 'OWNER' && (actor.role === 'OWNER' || (actor.role === 'ADMIN' && target.role === 'USER'));
  return { edit, changeRole: edit && actor.role === 'OWNER', preview: edit && actor.role === 'OWNER' && target.role === 'USER' };
}

export const adminProfileFields = ['name', 'bio', 'image', 'banner'] as const;
