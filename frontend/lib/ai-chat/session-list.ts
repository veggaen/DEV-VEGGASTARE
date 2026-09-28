/** @fileOverview Bounded AI conversation navigation contracts. @stability stable */
import { z } from 'zod';

export const SessionId = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
export const SessionListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: SessionId.optional(),
  q: z.string().trim().max(200).default(''),
  view: z.enum(['full', 'rail']).default('full'),
}).strict();
export const SessionRailResponse = z.object({
  sessions: z.array(z.object({ id: SessionId, title: z.string().max(200), updatedAt: z.string().datetime() })).max(100),
  nextCursor: SessionId.nullable(),
});
export type ShellSession = z.infer<typeof SessionRailResponse>['sessions'][number];

export function conversationListError(status: number) {
  return status === 401 ? 'Your session has expired. Sign in again.'
    : status === 429 ? 'Too many requests. Wait a moment, then retry.'
      : 'Conversations could not be loaded. Please retry.';
}
