/** @fileOverview Owner/moderator administration; participant reads use /api/messages. */
export {
  readManagedConversation as GET,
  updateManagedConversation as PATCH,
  deleteManagedConversation as DELETE,
} from '@/lib/conversation-management';
