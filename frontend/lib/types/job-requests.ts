import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const JobRequestUserSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    image: z.string().nullable(),
  })
  .strict();

export const JobRequestDtoSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    title: z.string().nullable(),

    descriptions: z.array(z.string()),
    images: z.array(z.string()),
    links: z.array(z.string()),
    docs: z.array(z.string()),

    price: z.number().finite().nullable(),
    negotiable: z.boolean().nullable(),
    paymentMethod: z.string().nullable(),
    delivery: z.string().nullable(),
    additionalNotes: z.string().nullable(),

    companyIds: z.array(z.string()),

    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,

    user: JobRequestUserSummarySchema,
  })
  .strict();

export const JobRequestsListResponseSchema = z.array(JobRequestDtoSchema);

export const JobRequestCreateResponseSchema = z
  .object({
    success: z.literal(true),
    jobRequest: JobRequestDtoSchema,
  })
  .strict();

export const JobRequestErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string().min(1),
  })
  .strict();

export type JobRequestUserSummary = z.infer<typeof JobRequestUserSummarySchema>;
export type JobRequestDto = z.infer<typeof JobRequestDtoSchema>;
export type JobRequestsListResponse = z.infer<typeof JobRequestsListResponseSchema>;
export type JobRequestCreateResponse = z.infer<typeof JobRequestCreateResponseSchema>;
