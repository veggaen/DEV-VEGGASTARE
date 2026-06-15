import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const AdminUserListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string(),
    referredBy: z.string(),
    role: z.string(),
    isTwoFactorEnabled: z.boolean(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export const AdminUsersListResponseSchema = z.array(AdminUserListItemSchema);

export const UserCountsSchema = z
  .object({
    followers: z.number().int().finite(),
    following: z.number().int().finite(),
    posts: z.number().int().finite(),
  })
  .strict();

export const UserReachSchema = z
  .object({
    totalViews: z.number().int().finite(),
    uniqueViewers: z.number().int().finite(),
    totalReplies: z.number().int().finite(),
    engagementRate: z.number().finite(),
    // 7-Pillar Reach (optional — populated when data exists)
    reachLifetime: z.number().finite().optional(),
    reachMomentum: z.number().finite().optional(),
    // Pillar breakdown (0-100 each)
    visibility: z.number().finite().optional(),
    engagementDepth: z.number().finite().optional(),
    conversionImpact: z.number().finite().optional(),
    loyalty: z.number().finite().optional(),
    growth: z.number().finite().optional(),
    recall: z.number().finite().optional(),
    velocity: z.number().finite().optional(),
    trueReachScore: z.number().finite().optional(),
  })
  .strict();

export const UserProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    username: z.string().min(1),

    // Only present for own profile or admins.
    email: z.string().nullable().optional(),

    image: z.string().nullable(),
    banner: z.string().nullable(),
    bio: z.string().nullable(),
    createdAt: IsoDateStringSchema,

    // Only present for admins.
    role: z.string().nullable().optional(),

    _count: UserCountsSchema,
    reach: UserReachSchema,
  })
  .strict();

export const UserProfileGetResponseSchema = z
  .object({
    user: UserProfileSchema,
  })
  .strict();

export const UserProfilePatchResponseSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        name: z.string().nullable(),
        email: z.string().nullable().optional(),
        image: z.string().nullable(),
        banner: z.string().nullable(),
        bio: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export const UserPreviewResponseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    image: z.string().nullable(),
    banner: z.string().nullable(),
    bio: z.string().nullable(),
    createdAt: IsoDateStringSchema,
    _count: z
      .object({
        followers: z.number().int().finite(),
        following: z.number().int().finite(),
      })
      .strict(),
    isFollowing: z.boolean(),
  })
  .strict();

export const UserFollowStatusResponseSchema = z
  .object({
    followerCount: z.number().int().finite(),
    followingCount: z.number().int().finite(),
    isFollowing: z.boolean(),
  })
  .strict();

export const UserFollowMutationResponseSchema = z
  .object({
    success: z.literal(true),
    isFollowing: z.boolean(),
    followerCount: z.number().int().finite(),
    followingCount: z.number().int().finite(),
  })
  .strict();

export const UserFollowListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
    bio: z.string().nullable(),

    followerCount: z.number().int().finite(),
    followingCount: z.number().int().finite(),
    isFollowing: z.boolean(),

    followedAt: IsoDateStringSchema,
  })
  .strict();

export const UserFollowListResponseSchema = z
  .object({
    users: z.array(UserFollowListItemSchema),
    nextCursor: z.string().min(1).nullable(),
    total: z.number().int().finite(),
  })
  .strict();

export const UserSearchResultItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string().nullable(),
    image: z.string(),
    role: z.string().nullable(),
    bio: z.string().nullable(),
    followerCount: z.number().int().finite(),
    isFollowing: z.boolean(),
  })
  .strict();

export const UserSearchResponseSchema = z
  .object({
    users: z.array(UserSearchResultItemSchema),
    count: z.number().int().finite(),
  })
  .strict();

export const UserSuggestionItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
    bio: z.string().nullable(),
    reason: z.string(),
    priority: z.number().int().finite(),
    followerCount: z.number().int().finite(),
    isFollowing: z.boolean(),
  })
  .strict();

export const UserSuggestionsResponseSchema = z
  .object({
    suggestions: z.array(UserSuggestionItemSchema),
  })
  .strict();

export const UserPrivacySettingsResponseSchema = z
  .object({
    showPulsesGiven: z.boolean(),
    showPulsesReceived: z.boolean(),
    showNegativePulses: z.boolean(),
    showRepulses: z.boolean(),
    allowNegativePulses: z.boolean(),
  })
  .strict();

export const ValidateUserResponseSchema = z
  .union([
    z
      .object({
        isValid: z.literal(true),
        user: z
          .object({
            id: z.string().min(1),
            name: z.string().nullable(),
            email: z.string().nullable(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        isValid: z.literal(false),
        message: z.string().min(1),
      })
      .strict(),
  ])
  .describe('Validate-user response DTO');

export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserPreviewResponse = z.infer<typeof UserPreviewResponseSchema>;
export type UserFollowListItem = z.infer<typeof UserFollowListItemSchema>;
export type UserSuggestionItem = z.infer<typeof UserSuggestionItemSchema>;
