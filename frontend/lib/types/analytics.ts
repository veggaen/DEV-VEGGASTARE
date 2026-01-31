import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

const AnalyticsPointCompaniesSchema = z
  .object({
    date: IsoDateStringSchema,
    companies: z.number().int().nonnegative(),
  })
  .strict();

const AnalyticsPointUsersSchema = z
  .object({
    date: IsoDateStringSchema,
    users: z.number().int().nonnegative(),
  })
  .strict();

export const AnalyticsCompaniesSuccessResponseSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            label: z.string().min(1),
            data: z.array(AnalyticsPointCompaniesSchema),
          })
          .strict()
      )
      .min(1),
    firstCompanyDate: IsoDateStringSchema,
    lastCompanyDate: IsoDateStringSchema,
    today: IsoDateStringSchema,
  })
  .strict();

export const AnalyticsCompaniesEmptyResponseSchema = z
  .object({
    data: z.array(z.unknown()).length(0),
    error: z.string().min(1),
  })
  .strict();

export const AnalyticsCompaniesResponseSchema = z.union([
  AnalyticsCompaniesSuccessResponseSchema,
  AnalyticsCompaniesEmptyResponseSchema,
]);

export const AnalyticsProductsSuccessResponseSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            label: z.string().min(1),
            // NOTE: current route returns `users` as the key for the cumulative count.
            data: z.array(AnalyticsPointUsersSchema),
          })
          .strict()
      )
      .min(1),
    firstProductDate: IsoDateStringSchema,
    lastProductDate: IsoDateStringSchema,
    today: IsoDateStringSchema,
  })
  .strict();

export const AnalyticsProductsEmptyResponseSchema = z
  .object({
    data: z.array(z.unknown()).length(0),
    error: z.string().min(1),
  })
  .strict();

export const AnalyticsProductsResponseSchema = z.union([
  AnalyticsProductsSuccessResponseSchema,
  AnalyticsProductsEmptyResponseSchema,
]);

export const AnalyticsUsersSuccessResponseSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            label: z.string().min(1),
            data: z.array(AnalyticsPointUsersSchema),
          })
          .strict()
      )
      .min(1),
    firstUserDate: IsoDateStringSchema,
    lastUserDate: IsoDateStringSchema,
    today: IsoDateStringSchema,
  })
  .strict();

export const AnalyticsUsersEmptyResponseSchema = z
  .object({
    data: z.array(z.unknown()).length(0),
    error: z.string().min(1),
  })
  .strict();

export const AnalyticsUsersResponseSchema = z.union([
  AnalyticsUsersSuccessResponseSchema,
  AnalyticsUsersEmptyResponseSchema,
]);

export const UserProductCreationAnalyticsResponseSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            label: z.string().min(1),
            count: z.number().int().nonnegative(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

const ReachViewBreakdownItemSchema = z
  .object({
    type: z.string().min(1),
    count: z.number().int().nonnegative(),
    totalStrength: z.number().nonnegative(),
  })
  .strict();

const ReachViewerSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        name: z.string().nullable(),
        image: z.string().nullable(),
      })
      .strict(),
    viewCount: z.number().int().nonnegative(),
    firstViewedAt: IsoDateStringSchema,
    lastViewedAt: IsoDateStringSchema,
  })
  .strict();

export const ReachConversationResponseSchema = z
  .object({
    conversation: z
      .object({
        id: z.string().min(1),
        title: z.string().nullable(),
        viewCount: z.number().int().nonnegative(),
        uniqueViewCount: z.number().int().nonnegative(),
        uniqueIpCount: z.number().int().nonnegative(),
        loggedInViewCount: z.number().int().nonnegative(),
        anonymousViewCount: z.number().int().nonnegative(),
        reachScore: z.number().nonnegative(),
        replyCount: z.number().int().nonnegative(),
        uniqueRepliers: z.number().int().nonnegative(),
        createdAt: IsoDateStringSchema,
        engagementRate: z.string().min(1),
        qualityScore: z.string().min(1),
      })
      .strict(),
    viewBreakdown: z.array(ReachViewBreakdownItemSchema),
    topViewers: z.array(ReachViewerSchema),
  })
  .strict();

export const ReachTotalsResponseSchema = z
  .object({
    totals: z
      .object({
        totalViews: z.number().int().nonnegative(),
        uniqueViews: z.number().int().nonnegative(),
        uniqueIps: z.number().int().nonnegative(),
        loggedInViews: z.number().int().nonnegative(),
        anonymousViews: z.number().int().nonnegative(),
        totalReachScore: z.number().nonnegative(),
        totalReplies: z.number().int().nonnegative(),
        postCount: z.number().int().nonnegative(),
        avgEngagementRate: z.string().min(1),
        reachQuality: z.string().min(1),
      })
      .strict(),
    topPosts: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string().nullable(),
          reachScore: z.number().nonnegative(),
          viewCount: z.number().int().nonnegative(),
          uniqueViewCount: z.number().int().nonnegative(),
        })
        .strict()
    ),
    recentViewBreakdown: z.array(ReachViewBreakdownItemSchema),
  })
  .strict();

export const ReachErrorResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export const ReachResponseSchema = z.union([
  ReachConversationResponseSchema,
  ReachTotalsResponseSchema,
  ReachErrorResponseSchema,
]);
