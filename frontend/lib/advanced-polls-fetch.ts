/**
 * Raw SQL fallback for fetching advanced polls when Prisma throws P2022
 * (column does not exist – e.g. generated client expects correctAnswer/explanation/answerMode
 *  but schema stores those in sliderConfig JSON).
 *
 * Run `npx prisma generate` to regenerate the client and fix the root cause.
 */

import type { PrismaClient } from '@/generated/prisma/client';

type PollRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  creatorId: string;
  conversationId: string | null;
  isAnonymous: boolean;
  allowPartial: boolean;
  requiresAuth: boolean;
  expiresAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalResponses: number;
  avgCompletionPct: number;
};

type QuestionRow = {
  id: string;
  advancedPollId: string;
  parentQuestionId: string | null;
  text: string;
  description: string | null;
  type: string;
  order: number;
  isRequired: boolean;
  allowImages: boolean;
  allowComments: boolean;
  sliderConfig: unknown;
};

type OptionRow = {
  id: string;
  questionId: string;
  text: string;
  order: number;
  value: number | null;
  imageUrl: string | null;
};

type CreatorRow = {
  id: string;
  name: string | null;
  image: string | null;
};

export async function fetchPollWithRawSql(
  db: PrismaClient,
  pollId: string,
): Promise<{
  poll: PollRow & { Creator: CreatorRow; Questions: (QuestionRow & { Options: OptionRow[]; ChildQuestions: (QuestionRow & { Options: OptionRow[] })[] })[] };
} | null> {
  const pollRows = await db.$queryRawUnsafe<PollRow[]>(
    `SELECT id, title, description, type, "creatorId", "conversationId", "isAnonymous", "allowPartial", "requiresAuth", "expiresAt", "publishedAt", "createdAt", "updatedAt", "totalResponses", "avgCompletionPct" FROM "AdvancedPoll" WHERE id = $1`,
    pollId,
  );
  const poll = pollRows?.[0];
  if (!poll) return null;

  const creatorRows = await db.$queryRawUnsafe<CreatorRow[]>(
    `SELECT id, name, image FROM "User" WHERE id = $1`,
    poll.creatorId,
  );
  const Creator = creatorRows?.[0] ?? { id: poll.creatorId, name: null, image: null };

  const questions = await db.$queryRawUnsafe<QuestionRow[]>(
    `SELECT id, "advancedPollId", "parentQuestionId", text, description, type, "order", "isRequired", "allowImages", "allowComments", "sliderConfig" FROM "PollQuestion" WHERE "advancedPollId" = $1 AND "parentQuestionId" IS NULL ORDER BY "order" ASC`,
    pollId,
  );

  const allQuestionIds = new Set<string>();
  questions.forEach((q) => allQuestionIds.add(q.id));

  const childQuestionsByParent = new Map<string, QuestionRow[]>();
  if (allQuestionIds.size > 0) {
    const placeholders = Array.from(allQuestionIds).map((_, i) => `$${i + 1}`).join(',');
    const children = await db.$queryRawUnsafe<QuestionRow[]>(
      `SELECT id, "advancedPollId", "parentQuestionId", text, description, type, "order", "isRequired", "allowImages", "allowComments", "sliderConfig" FROM "PollQuestion" WHERE "parentQuestionId" IN (${placeholders}) ORDER BY "order" ASC`,
      ...Array.from(allQuestionIds),
    );
    for (const c of children) {
      const pid = c.parentQuestionId;
      if (pid) {
        const arr = childQuestionsByParent.get(pid) ?? [];
        arr.push(c);
        childQuestionsByParent.set(pid, arr);
        allQuestionIds.add(c.id);
      }
    }
  }

  const allIds = Array.from(allQuestionIds);
  const optionsByQuestion = new Map<string, OptionRow[]>();
  if (allIds.length > 0) {
    const placeholders = allIds.map((_, i) => `$${i + 1}`).join(',');
    const options = await db.$queryRawUnsafe<OptionRow[]>(
      `SELECT id, "questionId", text, "order", value, "imageUrl" FROM "PollQuestionOption" WHERE "questionId" IN (${placeholders}) ORDER BY "order" ASC`,
      ...allIds,
    );
    for (const o of options) {
      const arr = optionsByQuestion.get(o.questionId) ?? [];
      arr.push(o);
      optionsByQuestion.set(o.questionId, arr);
    }
  }

  const mapQuestion = (q: QuestionRow): QuestionRow & { Options: OptionRow[]; ChildQuestions: (QuestionRow & { Options: OptionRow[] })[] } => ({
    ...q,
    Options: optionsByQuestion.get(q.id) ?? [],
    ChildQuestions: (childQuestionsByParent.get(q.id) ?? []).map(mapQuestion),
  });

  const Questions = questions.map(mapQuestion);

  return {
    poll: {
      ...poll,
      Creator,
      Questions,
    },
  };
}
