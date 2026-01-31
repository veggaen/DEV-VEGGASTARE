import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const FriendRequestStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED']);

export const FriendRequestUserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
    bio: z.string().nullable(),
    followerCount: z.number().int().finite(),
    followingCount: z.number().int().finite(),
  })
  .strict();

export const FriendRequestListItemSchema = z
  .object({
    id: z.string().min(1),
    status: FriendRequestStatusSchema,
    createdAt: IsoDateStringSchema,
    user: FriendRequestUserSchema,
  })
  .strict();

export const FriendRequestsListResponseSchema = z
  .object({
    requests: z.array(FriendRequestListItemSchema),
  })
  .strict();

export const FriendRequestRecordSchema = z
  .object({
    id: z.string().min(1),
    senderId: z.string().min(1),
    receiverId: z.string().min(1),
    status: FriendRequestStatusSchema,
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export const FriendRequestCreateResponseSchema = z
  .object({
    success: z.literal(true),
    request: FriendRequestRecordSchema,
  })
  .strict();

export const FriendRequestActionResponseSchema = z
  .object({
    success: z.literal(true),
    status: z.enum(['ACCEPTED', 'DECLINED']),
    message: z.string().min(1),
  })
  .strict();

export const FriendRequestDeleteResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().min(1),
  })
  .strict();

export type FriendRequestStatus = z.infer<typeof FriendRequestStatusSchema>;
export type FriendRequestUser = z.infer<typeof FriendRequestUserSchema>;
export type FriendRequestListItem = z.infer<typeof FriendRequestListItemSchema>;
export type FriendRequestsListResponse = z.infer<typeof FriendRequestsListResponseSchema>;
export type FriendRequestRecord = z.infer<typeof FriendRequestRecordSchema>;
export type FriendRequestCreateResponse = z.infer<typeof FriendRequestCreateResponseSchema>;
export type FriendRequestActionResponse = z.infer<typeof FriendRequestActionResponseSchema>;
export type FriendRequestDeleteResponse = z.infer<typeof FriendRequestDeleteResponseSchema>;
