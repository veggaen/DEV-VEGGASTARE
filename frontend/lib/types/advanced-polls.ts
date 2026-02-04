import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const AdvancedPollTypeSchema = z.enum([
  'SIMPLE',
  'SURVEY',
  'QUIZ',
  'FEEDBACK',
  'REACH_ASSESSMENT',
]);

export const PollQuestionTypeSchema = z.enum([
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'SLIDER',
  'SCALE',
  'TEXT',
  'NESTED',
  'RANKING',       // Drag-to-reorder options
  'UI_ARRANGE',    // Drag boxes to arrange UI elements
  'IMAGE_UPLOAD',  // Upload/paste images
  'TREE',          // Branching questions based on selection
]);

export type AdvancedPollType = z.infer<typeof AdvancedPollTypeSchema>;
export type PollQuestionType = z.infer<typeof PollQuestionTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const SliderConfigSchema = z.object({
  min: z.number().default(0),
  max: z.number().default(100),
  steps: z.number().min(2).max(20).default(7),
  labels: z.array(z.string()).optional(),
  showValue: z.boolean().default(true),
});

export type SliderConfig = z.infer<typeof SliderConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL QUESTION OPTION
// ─────────────────────────────────────────────────────────────────────────────

export const PollQuestionOptionSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  text: z.string().min(1).max(500),
  order: z.number().int().min(0),
  value: z.number().int().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export const PollQuestionOptionCreateSchema = z.object({
  text: z.string().trim().min(1).max(500),
  order: z.number().int().min(0).default(0),
  value: z.number().int().optional(),
  imageUrl: z.string().url().optional(),
});

export type PollQuestionOption = z.infer<typeof PollQuestionOptionSchema>;
export type PollQuestionOptionCreate = z.infer<typeof PollQuestionOptionCreateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL QUESTION
// ─────────────────────────────────────────────────────────────────────────────

export const PollQuestionSchema = z.object({
  id: z.string().min(1),
  advancedPollId: z.string().min(1),
  parentQuestionId: z.string().min(1).optional().nullable(),
  text: z.string().min(1).max(1000),
  description: z.string().max(2000).optional().nullable(),
  type: PollQuestionTypeSchema,
  order: z.number().int().min(0),
  isRequired: z.boolean(),
  allowImages: z.boolean(),
  allowComments: z.boolean(),
  sliderConfig: SliderConfigSchema.optional().nullable(),
  options: z.array(PollQuestionOptionSchema).default([]),
  // Use z.any() for childQuestions to avoid circular reference issues
  childQuestions: z.array(z.any()).optional().default([]),
});

export const PollQuestionCreateSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(2000).optional(),
  type: PollQuestionTypeSchema.default('SINGLE_CHOICE'),
  order: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
  allowImages: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  sliderConfig: SliderConfigSchema.optional(),
  options: z.array(PollQuestionOptionCreateSchema).optional(),
  // Use z.any() to avoid circular reference
  childQuestions: z.array(z.any()).optional(),
});

export type PollQuestion = z.infer<typeof PollQuestionSchema>;
export type PollQuestionCreate = z.infer<typeof PollQuestionCreateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL ANSWER IMAGE
// ─────────────────────────────────────────────────────────────────────────────

export const PollAnswerImageSchema = z.object({
  id: z.string().min(1),
  answerId: z.string().min(1),
  url: z.string().url(),
  caption: z.string().max(500).optional().nullable(),
  order: z.number().int().min(0),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  aspectRatio: z.enum(['portrait', 'landscape', 'square']).optional().nullable(),
});

export const PollAnswerImageCreateSchema = z.object({
  url: z.string().url(),
  caption: z.string().trim().max(500).optional(),
  order: z.number().int().min(0).default(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  aspectRatio: z.enum(['portrait', 'landscape', 'square']).optional(),
});

export type PollAnswerImage = z.infer<typeof PollAnswerImageSchema>;
export type PollAnswerImageCreate = z.infer<typeof PollAnswerImageCreateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL ANSWER
// ─────────────────────────────────────────────────────────────────────────────

export const PollAnswerSchema = z.object({
  id: z.string().min(1),
  responseId: z.string().min(1),
  questionId: z.string().min(1),
  optionId: z.string().min(1).optional().nullable(),
  sliderValue: z.number().min(0).max(100).optional().nullable(),
  scaleValue: z.number().int().min(1).max(10).optional().nullable(),
  textValue: z.string().max(5000).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  images: z.array(PollAnswerImageSchema).default([]),
});

export const PollAnswerCreateSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1).optional(),
  sliderValue: z.number().min(0).max(100).optional(),
  scaleValue: z.number().int().min(1).max(10).optional(),
  textValue: z.string().trim().max(5000).optional(),
  comment: z.string().trim().max(2000).optional(),
  images: z.array(PollAnswerImageCreateSchema).max(5).optional(),
}).refine(
  (data) => data.optionId || data.sliderValue !== undefined || data.scaleValue !== undefined || data.textValue,
  { message: 'At least one answer type must be provided' }
);

export type PollAnswer = z.infer<typeof PollAnswerSchema>;
export type PollAnswerCreate = z.infer<typeof PollAnswerCreateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

export const PollResponseSchema = z.object({
  id: z.string().min(1),
  advancedPollId: z.string().min(1),
  userId: z.string().min(1).optional().nullable(),
  sessionId: z.string().optional().nullable(),
  completionPct: z.number().min(0).max(100),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
  responseQuality: z.number().min(0).max(1),
  answers: z.array(PollAnswerSchema).default([]),
});

export const PollResponseCreateSchema = z.object({
  answers: z.array(PollAnswerCreateSchema).min(1),
  isPartial: z.boolean().default(false),
});

export type PollResponse = z.infer<typeof PollResponseSchema>;
export type PollResponseCreate = z.infer<typeof PollResponseCreateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED POLL
// ─────────────────────────────────────────────────────────────────────────────

export const AdvancedPollSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  type: AdvancedPollTypeSchema,
  creatorId: z.string().min(1),
  conversationId: z.string().min(1).optional().nullable(),
  isAnonymous: z.boolean(),
  allowPartial: z.boolean(),
  requiresAuth: z.boolean(),
  expiresAt: z.string().datetime().optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  totalResponses: z.number().int().min(0),
  avgCompletionPct: z.number().min(0).max(100),
  questions: z.array(PollQuestionSchema).default([]),
});

export const AdvancedPollCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  type: AdvancedPollTypeSchema.default('SURVEY'),
  conversationId: z.string().min(1).optional(),
  isAnonymous: z.boolean().default(false),
  allowPartial: z.boolean().default(true),
  requiresAuth: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  questions: z.array(PollQuestionCreateSchema).min(1).max(50),
});

export const AdvancedPollUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  isAnonymous: z.boolean().optional(),
  allowPartial: z.boolean().optional(),
  requiresAuth: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
});

export type AdvancedPoll = z.infer<typeof AdvancedPollSchema>;
export type AdvancedPollCreate = z.infer<typeof AdvancedPollCreateSchema>;
export type AdvancedPollUpdate = z.infer<typeof AdvancedPollUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export const PollTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  structure: z.any(), // JSON structure
  category: z.string().max(50).optional().nullable(),
  isPublic: z.boolean(),
  usageCount: z.number().int().min(0),
  creatorId: z.string().min(1).optional().nullable(),
  advancedPollId: z.string().min(1).optional().nullable(),
  createdAt: z.string().datetime(),
});

export const PollTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  structure: z.any(), // Will validate structure separately
  category: z.string().trim().max(50).optional(),
  isPublic: z.boolean().default(false),
});

export type PollTemplate = z.infer<typeof PollTemplateSchema>;
export type PollTemplateCreate = z.infer<typeof PollTemplateCreateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const AdvancedPollListResponseSchema = z.object({
  polls: z.array(AdvancedPollSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

export const AdvancedPollDetailResponseSchema = z.object({
  poll: AdvancedPollSchema,
  userResponse: PollResponseSchema.optional().nullable(),
});

export const PollResponseSubmitResponseSchema = z.object({
  response: PollResponseSchema,
  message: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const PollQuestionAnalyticsSchema = z.object({
  questionId: z.string().min(1),
  questionText: z.string(),
  questionType: PollQuestionTypeSchema,
  totalAnswers: z.number().int().min(0),
  // For choice questions
  optionBreakdown: z.array(z.object({
    optionId: z.string().min(1),
    optionText: z.string(),
    count: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
  })).optional(),
  // For slider questions
  sliderStats: z.object({
    average: z.number(),
    median: z.number(),
    min: z.number(),
    max: z.number(),
    distribution: z.array(z.object({
      value: z.number(),
      count: z.number().int(),
    })),
  }).optional(),
  // For scale questions
  scaleStats: z.object({
    average: z.number(),
    distribution: z.array(z.object({
      value: z.number().int(),
      count: z.number().int(),
    })),
  }).optional(),
});

export const PollAnalyticsResponseSchema = z.object({
  pollId: z.string().min(1),
  pollTitle: z.string(),
  totalResponses: z.number().int().min(0),
  avgCompletionPct: z.number().min(0).max(100),
  completedResponses: z.number().int().min(0),
  partialResponses: z.number().int().min(0),
  avgResponseQuality: z.number().min(0).max(1),
  responsesOverTime: z.array(z.object({
    date: z.string(),
    count: z.number().int().min(0),
  })),
  questions: z.array(PollQuestionAnalyticsSchema),
});

export type PollQuestionAnalytics = z.infer<typeof PollQuestionAnalyticsSchema>;
export type PollAnalyticsResponse = z.infer<typeof PollAnalyticsResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POLL PARSE SCHEMAS (Text import)
// ─────────────────────────────────────────────────────────────────────────────

export const PollParseInputSchema = z.object({
  content: z.string().min(1).max(50000),
  format: z.enum(['auto', 'simple', 'structured']).default('auto'),
});

export const PollParseResponseSchema = z.object({
  success: z.boolean(),
  poll: AdvancedPollCreateSchema.optional(),
  errors: z.array(z.object({
    line: z.number().int().optional(),
    message: z.string(),
  })).optional(),
});

export type PollParseInput = z.infer<typeof PollParseInputSchema>;
export type PollParseResponse = z.infer<typeof PollParseResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY & ANTI-GAMING CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const POLL_SECURITY_CONFIG = {
  minTimeToFirstAnswer: 2000, // 2 seconds
  minTimePerQuestion: 1500, // 1.5 seconds
  maxAnswersPerMinute: 30,
  requireAuthForTypes: ['REACH_ASSESSMENT', 'QUIZ'] as AdvancedPollType[],
  maxResponsesPerIpPerHour: 5,
  flagPatterns: {
    allSameChoice: true,
    linearSlider: true,
    tooFast: true,
    duplicateSessionId: true,
  },
  flagKnownVpnIps: true,
} as const;
