import { z } from 'zod';

export const MessageUserSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    image: z.string().nullable().optional(),
  })
  .strict();

export const MessageResponseSchema = z
  .object({
    id: z.string().min(1),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    senderId: z.string().min(1),
    conversationId: z.string().min(1),
    createdAt: z.union([z.string().min(1), z.date()]),
    editedAt: z.union([z.string().min(1), z.date()]).nullable().optional(),

    // Back-compat (existing API includes `User`)
    User: MessageUserSummarySchema.nullable().optional(),

    // Normalized alias for clients that expect `sender`
    sender: MessageUserSummarySchema.nullable().optional(),
  })
  .strict();

export const ConversationRepostSummarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().nullable(),
    createdAt: z.union([z.string().min(1), z.date()]),
    User: MessageUserSummarySchema.nullable().optional(),
    Message: z
      .array(
        z
          .object({
            id: z.string().min(1).optional(),
            content: z.string().optional(),
            createdAt: z.union([z.string().min(1), z.date()]).optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

export const ConversationDetailsResponseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().nullable(),

    // Optional pulse fields (PUBLIC_THREAD)
    description: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    messageCount: z.number().int().finite().optional(),
    viewCount: z.number().int().finite().optional(),
    uniqueViewCount: z.number().int().finite().optional(),
    repostCount: z.number().int().finite().optional(),
    positivePulseCount: z.number().int().finite().optional(),
    hasPoll: z.boolean().optional(),

    type: z.enum(['PUBLIC_THREAD', 'PRIVATE_DM', 'GROUP', 'RESTRICTED']),
    userId: z.string().min(1),
    originalUserId: z.string().nullable().optional(),

    deletionRequestedAt: z.union([z.string().min(1), z.date()]).nullable().optional(),
    deletionScheduledFor: z.union([z.string().min(1), z.date()]).nullable().optional(),
    deletionVisibility: z.enum(['PUBLIC', 'PRIVATE']).nullable().optional(),
    isAnonymized: z.boolean(),

    createdAt: z.union([z.string().min(1), z.date()]).optional(),
    updatedAt: z.union([z.string().min(1), z.date()]).optional(),

    participants: z.array(z.string()).optional(),
    participantDetails: z.array(MessageUserSummarySchema).optional(),

    // Back-compat (existing API includes `User`)
    User: MessageUserSummarySchema.nullable().optional(),

    // Normalized alias for clients that expect `user`
    user: MessageUserSummarySchema.nullable().optional(),

    // Optional nested relation (kept to avoid breaking unknown callers)
    Conversation: ConversationRepostSummarySchema.nullable().optional(),
  })
  .strict();

export const MessagesGetResponseSchema = z
  .object({
    messages: z.array(MessageResponseSchema),
    users: z.array(MessageUserSummarySchema),
    conversation: ConversationDetailsResponseSchema,
  })
  .strict();

export type MessageUserSummary = z.infer<typeof MessageUserSummarySchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ConversationDetailsResponse = z.infer<typeof ConversationDetailsResponseSchema>;
export type MessagesGetResponse = z.infer<typeof MessagesGetResponseSchema>;
