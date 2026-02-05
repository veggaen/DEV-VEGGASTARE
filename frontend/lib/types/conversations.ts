import { z } from 'zod';

export const ConversationTypeSchema = z.enum([
  'PUBLIC_THREAD',
  'PRIVATE_DM',
  'GROUP',
  'RESTRICTED',
]);

export const ConversationVisibilitySchema = z.enum([
  'PUBLIC',
  'PARTICIPANTS',
  'ROLE_BASED',
  'CUSTOM',
]);

export const ReplyPermissionSchema = z.enum([
  'EVERYONE',
  'PARTICIPANTS',
  'MENTIONED',
  'MODS_ONLY',
  'CREATOR_ONLY',
]);

export const DeletionVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);

export const ConversationUserSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    referredBy: z.string().nullable().optional(),
  })
  .strict();

export const ConversationMessageSummarySchema = z
  .object({
    id: z.string().min(1),
    content: z.string(),
    createdAt: z.union([z.string().min(1), z.date()]),
    imageUrl: z.string().nullable().optional(),
    senderId: z.string().nullable().optional(),
  })
  .strict();

export const ConversationPollSummarySchema = z
  .object({
    id: z.string().min(1),
    question: z.string().nullable().optional(),
  })
  .strict();

export const ConversationRepostOfConversationSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().nullable(),
    createdAt: z.union([z.string().min(1), z.date()]),
    user: ConversationUserSummarySchema.optional(),
    User: ConversationUserSummarySchema.optional(),
    lastMessage: ConversationMessageSummarySchema.nullable().optional(),
  })
  .strict();

export const ConversationListItemSchema = z
  .object({
    id: z.string().min(1),
    companyId: z.string().nullable().optional(),

    title: z.string(),
    description: z.string().nullable().optional(),

    userId: z.string().min(1),
    participants: z.array(z.string()),
    participantDetails: z.array(ConversationUserSummarySchema),

    createdAt: z.union([z.string().min(1), z.date()]),
    updatedAt: z.union([z.string().min(1), z.date()]),
    editedAt: z.union([z.string().min(1), z.date()]).nullable().optional(),
    lastActivityAt: z.union([z.string().min(1), z.date()]).nullable().optional(),

    allowedRoles: z.array(z.string()).optional(),
    customViewers: z.array(z.string()).optional(),

    isLocked: z.boolean(),
    isPinned: z.boolean(),
    pinnedToFeed: z.boolean().optional(),
    pinnedToProfile: z.boolean().optional(),
    replyPermission: ReplyPermissionSchema,
    tags: z.array(z.string()),
    type: ConversationTypeSchema,
    visibility: ConversationVisibilitySchema,

    replyCount: z.number().int().finite().optional(),
    uniqueRepliers: z.number().int().finite().optional(),
    viewCount: z.number().int().finite().optional(),
    uniqueViewCount: z.number().int().finite().optional(),

    deletionRequestedAt: z.union([z.string().min(1), z.date()]).nullable().optional(),
    deletionScheduledFor: z.union([z.string().min(1), z.date()]).nullable().optional(),
    deletionVisibility: DeletionVisibilitySchema.nullable().optional(),

    isAnonymized: z.boolean().optional(),
    originalUserId: z.string().nullable().optional(),

    repostOfConversationId: z.string().nullable().optional(),
    repostOfConversation: ConversationRepostOfConversationSchema.nullable().optional(),
    // Back-compat: Prisma include uses `Conversation`.
    Conversation: ConversationRepostOfConversationSchema.nullable().optional(),

    lastMessage: ConversationMessageSummarySchema.nullable(),
    repostOfLastMessage: z
      .object({
        content: z.string(),
        createdAt: z.union([z.string().min(1), z.date()]),
      })
      .strict()
      .nullable()
      .optional(),

    messageCount: z.number().int().finite(),
    repostCount: z.number().int().finite(),
    quoteRepostCount: z.number().int().finite().optional(),
    hasReposted: z.boolean(),

    hasPoll: z.boolean(),
    poll: ConversationPollSummarySchema.nullable().optional(),
    // Back-compat: Prisma include uses `Poll`.
    Poll: ConversationPollSummarySchema.nullable().optional(),
    
    // Advanced polls (surveys, REACH feedback, etc.)
    advancedPoll: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable().optional(),
      type: z.string(),
      totalResponses: z.number().int(),
      avgCompletionPct: z.number(),
    }).nullable().optional(),
    // Back-compat: Prisma include uses `AdvancedPoll`.
    AdvancedPoll: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable().optional(),
      type: z.string(),
      totalResponses: z.number().int(),
      avgCompletionPct: z.number(),
    }).nullable().optional(),

    positivePulseCount: z.number().int().finite(),
    negativePulseCount: z.number().int().finite(),
    userPulse: z.enum(['POSITIVE', 'NEGATIVE']).nullable(),

    // Back-compat: Prisma include uses `User`.
    User: ConversationUserSummarySchema,
    // Normalized alias for clients that expect `user`.
    user: ConversationUserSummarySchema.optional(),

    // Back-compat: Prisma include uses `Message`.
    Message: z.array(ConversationMessageSummarySchema).optional(),
    // Normalized alias for clients that expect `messages`.
    messages: z.array(ConversationMessageSummarySchema).optional(),
  })
  .strict();

export const ConversationsListResponseSchema = z
  .object({
    conversations: z.array(ConversationListItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

// ---- Pulse endpoint DTOs ----

export const PulseTypeSchema = z.enum(['POSITIVE', 'NEGATIVE']);
export const PulseActionSchema = z.enum(['added', 'removed', 'switched']);

export const ConversationPulsePostResponseSchema = z
  .object({
    action: PulseActionSchema,
    currentPulse: PulseTypeSchema.nullable(),
    positivePulseCount: z.number().int().finite(),
    negativePulseCount: z.number().int().finite(),
  })
  .strict();

export const ConversationPulseGetResponseSchema = z
  .object({
    positivePulseCount: z.number().int().finite(),
    negativePulseCount: z.number().int().finite().nullable(),
    userPulse: PulseTypeSchema.nullable(),
    showNegativePulses: z.boolean(),
  })
  .strict();

export const ConversationPulseDeleteResponseSchema = z
  .object({
    removed: z.boolean(),
    positivePulseCount: z.number().int().finite(),
    negativePulseCount: z.number().int().finite(),
  })
  .strict();

// ---- Repost endpoint DTOs ----

export const ConversationRepostDeleteResponseSchema = z
  .object({
    reposted: z.literal(false),
  })
  .strict();

export const ConversationRepostPostResponseSchema = z
  .discriminatedUnion('mode', [
    z
      .object({
        reposted: z.literal(true),
        mode: z.literal('repost'),
      })
      .strict(),
    z
      .object({
        reposted: z.literal(true),
        mode: z.literal('quote'),
        conversationId: z.string().min(1),
      })
      .strict(),
  ]);

// ---- View tracking endpoint DTOs ----

export const ConversationViewTypeSchema = z.enum([
  'FIRST_VIEW',
  'REPEAT_VIEW',
  'ANONYMOUS_VIEW',
  'SAME_IP_NEW_USER',
  'UNIQUE_IP_NEW_USER',
]);

export const ViewStrengthCategorySchema = z.enum([
  'very_weak',
  'weak',
  'moderate',
  'strong',
  'very_strong',
]);

export const VerificationTierSchema = z.enum([
  'ANONYMOUS',
  'WALLET_ONLY',
  'WEB2_BASIC',
  'WEB3_BASIC',
  'SOCIAL_BASIC',
  'SOCIAL_VERIFIED',
  'WEB2_PAYMENT',
  'WEB3_VERIFIED',
  'WEB3_PAYMENT',
  'PAYMENT_VERIFIED',
  'PHONE_VERIFIED',
  'FULLY_VERIFIED',
]);

export const ConversationViewPostResponseSchema = z
  .object({
    success: z.literal(true),
    viewType: ConversationViewTypeSchema,
    strength: z.number().finite(),
    strengthCategory: ViewStrengthCategorySchema,
    verificationTier: VerificationTierSchema,
    isFirstView: z.boolean(),
  })
  .strict();

export const ConversationAdminResponseSchema = z
  .object({
    id: z.string().min(1),
    companyId: z.string().nullable().optional(),

    title: z.string().nullable(),
    description: z.string().nullable().optional(),

    userId: z.string().min(1),
    participants: z.array(z.string()),

    createdAt: z.union([z.string().min(1), z.date()]),
    updatedAt: z.union([z.string().min(1), z.date()]),
    editedAt: z.union([z.string().min(1), z.date()]).nullable().optional(),

    allowedRoles: z.array(z.string()).optional(),
    customViewers: z.array(z.string()).optional(),

    isLocked: z.boolean(),
    isPinned: z.boolean(),
    pinnedToFeed: z.boolean().optional(),
    pinnedToProfile: z.boolean().optional(),
    replyPermission: ReplyPermissionSchema,
    tags: z.array(z.string()),
    type: ConversationTypeSchema,
    visibility: ConversationVisibilitySchema,

    lastActivityAt: z.union([z.string().min(1), z.date()]).optional(),

    replyCount: z.number().int().finite().optional(),
    uniqueRepliers: z.number().int().finite().optional(),
    viewCount: z.number().int().finite().optional(),
    uniqueViewCount: z.number().int().finite().optional(),

    deletionRequestedAt: z.union([z.string().min(1), z.date()]).nullable().optional(),
    deletionScheduledFor: z.union([z.string().min(1), z.date()]).nullable().optional(),
    deletionVisibility: DeletionVisibilitySchema.nullable().optional(),

    isAnonymized: z.boolean(),
    originalUserId: z.string().nullable().optional(),

    suspiciousActivity: z.boolean().optional(),
    suspiciousReason: z.string().nullable().optional(),

    repostOfConversationId: z.string().nullable().optional(),

    uniqueIpCount: z.number().int().finite().optional(),
    loggedInViewCount: z.number().int().finite().optional(),
    anonymousViewCount: z.number().int().finite().optional(),
    reachScore: z.number().finite().optional(),

    positivePulseCount: z.number().int().finite().optional(),
    negativePulseCount: z.number().int().finite().optional(),
    repulseCount: z.number().int().finite().optional(),

    // Back-compat: Prisma include uses `User`.
    User: ConversationUserSummarySchema,

    // Normalized alias for clients that expect `user`.
    user: ConversationUserSummarySchema.optional(),
  })
  .strict();

export type ConversationAdminResponse = z.infer<typeof ConversationAdminResponseSchema>;
export type ConversationUserSummary = z.infer<typeof ConversationUserSummarySchema>;
export type ConversationListItem = z.infer<typeof ConversationListItemSchema>;
export type ConversationsListResponse = z.infer<typeof ConversationsListResponseSchema>;
export type ConversationPulsePostResponse = z.infer<typeof ConversationPulsePostResponseSchema>;
export type ConversationPulseGetResponse = z.infer<typeof ConversationPulseGetResponseSchema>;
export type ConversationPulseDeleteResponse = z.infer<typeof ConversationPulseDeleteResponseSchema>;
export type ConversationRepostPostResponse = z.infer<typeof ConversationRepostPostResponseSchema>;
export type ConversationRepostDeleteResponse = z.infer<typeof ConversationRepostDeleteResponseSchema>;
export type ConversationViewPostResponse = z.infer<typeof ConversationViewPostResponseSchema>;
export type ConversationType = z.infer<typeof ConversationTypeSchema>;
export type ConversationVisibility = z.infer<typeof ConversationVisibilitySchema>;
export type ReplyPermission = z.infer<typeof ReplyPermissionSchema>;
export type DeletionVisibility = z.infer<typeof DeletionVisibilitySchema>;
