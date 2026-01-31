import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const PollOptionSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    order: z.number().int().finite(),
    voteCount: z.number().int().finite(),
    percentage: z.number().int().min(0).max(100).finite(),
    hasVoted: z.boolean(),
    voters: z.array(z.string().min(1)),
  })
  .strict();

export const PollSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    allowMultiple: z.boolean(),
    isAnonymous: z.boolean(),
    expiresAt: IsoDateStringSchema.nullable(),
    isExpired: z.boolean(),
    totalVotes: z.number().int().finite(),
    userVotedOptionIds: z.array(z.string().min(1)),
    options: z.array(PollOptionSchema),
  })
  .strict();

export const PollGetResponseSchema = z
  .object({
    poll: PollSchema.nullable(),
  })
  .strict();

export const PollCreateResponseSchema = z
  .object({
    poll: PollSchema,
  })
  .strict();

export const PollVoteResponseSchema = z
  .object({
    voted: z.boolean(),
    message: z.string().min(1),
  })
  .strict();

export type Poll = z.infer<typeof PollSchema>;
export type PollGetResponse = z.infer<typeof PollGetResponseSchema>;
export type PollCreateResponse = z.infer<typeof PollCreateResponseSchema>;
export type PollVoteResponse = z.infer<typeof PollVoteResponseSchema>;
