import { NextRequest, NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import {
  PollParseInputSchema,
  PollParseResponseSchema,
  type PollQuestionCreate,
  type AdvancedPollCreate,
} from '@/lib/types/advanced-polls';

const LOG_PREFIX = '[api/advanced-polls/parse]';
const isDev = process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/advanced-polls/parse - Parse text content into poll structure
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, PollParseInputSchema);
    if (!bodyResult.ok) return bodyResult.response;
    const { content, format } = bodyResult.data;

    const errors: Array<{ line?: number; message: string }> = [];
    
    // Parse based on format
    let poll: AdvancedPollCreate | undefined;
    
    if (format === 'simple' || format === 'auto') {
      poll = parseSimpleFormat(content, errors);
    }
    
    if ((!poll || errors.length > 0) && (format === 'structured' || format === 'auto')) {
      errors.length = 0; // Clear errors and try structured
      poll = parseStructuredFormat(content, errors);
    }

    if (!poll || errors.length > 0) {
      const parsed = PollParseResponseSchema.safeParse({
        success: false,
        errors: errors.length > 0 ? errors : [{ message: 'Could not parse content into a valid poll structure' }],
      });
      return NextResponse.json(parsed.data, { status: 400 });
    }

    const parsed = PollParseResponseSchema.safeParse({
      success: true,
      poll,
    });

    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid response DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error parsing poll:', error);
    return NextResponse.json(
      { message: 'Error parsing poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE FORMAT PARSER
// Parses formats like:
// "What is your favorite color?A,B,C,D"
// "Rate this 1-7?1,2,3,4,5,6,7"
// ─────────────────────────────────────────────────────────────────────────────

function parseSimpleFormat(content: string, errors: Array<{ line?: number; message: string }>): AdvancedPollCreate | undefined {
  const lines = content.trim().split('\n').filter(l => l.trim());
  
  if (lines.length === 0) {
    errors.push({ message: 'Empty content' });
    return undefined;
  }

  const questions: PollQuestionCreate[] = [];
  let title = 'Imported Poll';

  // Pattern: question?options (comma or nothing separated)
  const questionPattern = /^(.+?)\?([A-Za-z0-9,\s]+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // First line could be a title if it doesn't match question pattern
    if (i === 0 && !questionPattern.test(line) && !line.includes('?')) {
      title = line;
      continue;
    }

    const match = line.match(questionPattern);
    if (!match) {
      // Try to extract question without pattern
      if (line.includes('?')) {
        const [questionText, optionsRaw] = line.split('?');
        const options = parseOptions(optionsRaw);
        
        if (options.length > 0) {
          questions.push(createQuestion(questionText.trim(), options, questions.length));
        } else {
          // Text question
          questions.push({
            text: questionText.trim(),
            type: 'TEXT' as const,
            order: questions.length,
            isRequired: true,
            allowImages: false,
            allowComments: false,
          });
        }
      } else {
        errors.push({ line: lineNum, message: `Could not parse: "${line}"` });
      }
      continue;
    }

    const [, questionText, optionsRaw] = match;
    const options = parseOptions(optionsRaw);

    if (options.length === 0) {
      errors.push({ line: lineNum, message: `No options found in: "${line}"` });
      continue;
    }

    questions.push(createQuestion(questionText.trim(), options, questions.length));
  }

  if (questions.length === 0) {
    errors.push({ message: 'No valid questions found' });
    return undefined;
  }

  return {
    title,
    type: 'SURVEY' as const,
    isAnonymous: false,
    allowPartial: true,
    requiresAuth: false,
    questions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED FORMAT PARSER
// Parses formats like:
// POLL: Title
// DESCRIPTION: Description
// TYPE: SURVEY
// Q1: Question text
// TYPE: SLIDER
// OPTIONS: A, B, C, D
// ─────────────────────────────────────────────────────────────────────────────

function parseStructuredFormat(content: string, errors: Array<{ line?: number; message: string }>): AdvancedPollCreate | undefined {
  const lines = content.trim().split('\n');
  
  let title = 'Imported Poll';
  let description: string | undefined;
  let type: 'SIMPLE' | 'SURVEY' | 'QUIZ' | 'FEEDBACK' | 'REACH_ASSESSMENT' = 'SURVEY';
  let allowPartial = true;
  let isAnonymous = false;
  
  const questions: PollQuestionCreate[] = [];
  let currentQuestion: Partial<PollQuestionCreate> | null = null;

  const saveCurrentQuestion = () => {
    if (currentQuestion && currentQuestion.text) {
      questions.push({
        text: currentQuestion.text,
        description: currentQuestion.description,
        type: currentQuestion.type || 'SINGLE_CHOICE',
        order: questions.length,
        isRequired: currentQuestion.isRequired ?? true,
        allowImages: currentQuestion.allowImages ?? false,
        allowComments: currentQuestion.allowComments ?? false,
        sliderConfig: currentQuestion.sliderConfig,
        options: currentQuestion.options,
      });
    }
    currentQuestion = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Poll-level directives
    if (line.toUpperCase().startsWith('POLL:')) {
      title = line.slice(5).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('TITLE:')) {
      title = line.slice(6).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('DESCRIPTION:')) {
      description = line.slice(12).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('TYPE:') && !currentQuestion) {
      const pollType = line.slice(5).trim().toUpperCase();
      if (['SIMPLE', 'SURVEY', 'QUIZ', 'FEEDBACK', 'REACH_ASSESSMENT'].includes(pollType)) {
        type = pollType as typeof type;
      }
      continue;
    }
    if (line.toUpperCase().startsWith('ALLOW_PARTIAL:')) {
      allowPartial = line.slice(14).trim().toLowerCase() === 'true';
      continue;
    }
    if (line.toUpperCase().startsWith('ANONYMOUS:')) {
      isAnonymous = line.slice(10).trim().toLowerCase() === 'true';
      continue;
    }

    // Question start (Q1:, Q2:, etc.)
    const questionMatch = line.match(/^Q\d*:\s*(.+)$/i);
    if (questionMatch) {
      saveCurrentQuestion();
      currentQuestion = { text: questionMatch[1].trim() };
      continue;
    }

    // Question-level directives
    if (currentQuestion) {
      if (line.toUpperCase().startsWith('TYPE:')) {
        const qType = line.slice(5).trim().toUpperCase();
        if (['SINGLE_CHOICE', 'MULTI_CHOICE', 'SLIDER', 'SCALE', 'TEXT', 'NESTED'].includes(qType)) {
          currentQuestion.type = qType as PollQuestionCreate['type'];
        }
        continue;
      }
      if (line.toUpperCase().startsWith('OPTIONS:') || line.toUpperCase().startsWith('LABELS:')) {
        const optionsRaw = line.slice(line.indexOf(':') + 1).trim();
        const options = parseOptions(optionsRaw);
        
        if (currentQuestion.type === 'SLIDER') {
          currentQuestion.sliderConfig = {
            min: 0,
            max: 100,
            steps: options.length,
            showValue: true,
            labels: options.map(o => o.text),
          };
        } else {
          currentQuestion.options = options;
        }
        continue;
      }
      if (line.toUpperCase().startsWith('RANGE:')) {
        const rangeRaw = line.slice(6).trim();
        const [min, max] = rangeRaw.split(',').map(s => parseInt(s.trim(), 10));
        if (!isNaN(min) && !isNaN(max)) {
          currentQuestion.sliderConfig = {
            min,
            max,
            steps: max - min + 1,
            showValue: true,
          };
        }
        continue;
      }
      if (line.toUpperCase().startsWith('ALLOW_IMAGES:')) {
        currentQuestion.allowImages = line.slice(13).trim().toLowerCase() === 'true';
        continue;
      }
      if (line.toUpperCase().startsWith('ALLOW_COMMENT:') || line.toUpperCase().startsWith('ALLOW_COMMENTS:')) {
        currentQuestion.allowComments = line.slice(line.indexOf(':') + 1).trim().toLowerCase() === 'true';
        continue;
      }
      if (line.toUpperCase().startsWith('REQUIRED:')) {
        currentQuestion.isRequired = line.slice(9).trim().toLowerCase() !== 'false';
        continue;
      }
      if (line.toUpperCase().startsWith('DESC:') || line.toUpperCase().startsWith('DESCRIPTION:')) {
        currentQuestion.description = line.slice(line.indexOf(':') + 1).trim();
        continue;
      }
    }

    // If we get here with content and a current question, it might be an option line
    if (currentQuestion && line.match(/^[A-Z]\)/i)) {
      const optionText = line.slice(2).trim();
      if (!currentQuestion.options) currentQuestion.options = [];
      currentQuestion.options.push({
        text: optionText,
        order: currentQuestion.options.length,
      });
    }
  }

  // Save last question
  saveCurrentQuestion();

  if (questions.length === 0) {
    errors.push({ message: 'No valid questions found in structured format' });
    return undefined;
  }

  return {
    title,
    description,
    type,
    allowPartial,
    isAnonymous,
    requiresAuth: false,
    questions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseOptions(raw: string): Array<{ text: string; order: number }> {
  const options: Array<{ text: string; order: number }> = [];
  
  // Try comma-separated first
  if (raw.includes(',')) {
    raw.split(',').forEach((opt, i) => {
      const text = opt.trim();
      if (text) {
        // Remove leading A), B), 1), etc.
        const cleaned = text.replace(/^[A-Za-z0-9]\)\s*/, '');
        options.push({ text: cleaned || text, order: i });
      }
    });
  } else {
    // Single letters like "ABCD" or "ABC"
    const letters = raw.replace(/\s/g, '');
    if (/^[A-Za-z]+$/.test(letters)) {
      letters.split('').forEach((letter, i) => {
        options.push({ text: letter.toUpperCase(), order: i });
      });
    } else if (/^[0-9]+$/.test(letters)) {
      // Numbers like "1234567"
      letters.split('').forEach((num, i) => {
        options.push({ text: num, order: i });
      });
    }
  }

  return options;
}

function createQuestion(
  text: string,
  options: Array<{ text: string; order: number }>,
  order: number
): PollQuestionCreate {
  // Detect if this should be a slider based on options
  const isNumericScale = options.every(o => !isNaN(parseInt(o.text, 10)));
  const hasPercentages = options.some(o => o.text.includes('%'));
  
  if (options.length >= 5 && (isNumericScale || hasPercentages)) {
    return {
      text,
      type: 'SLIDER' as const,
      order,
      isRequired: true,
      allowImages: false,
      allowComments: false,
      sliderConfig: {
        min: 0,
        max: 100,
        steps: options.length,
        showValue: true,
        labels: options.map(o => o.text),
      },
    };
  }

  const questionType = options.length > 4 ? 'MULTI_CHOICE' : 'SINGLE_CHOICE';
  return {
    text,
    type: questionType as 'MULTI_CHOICE' | 'SINGLE_CHOICE',
    order,
    isRequired: true,
    allowImages: false,
    allowComments: false,
    options,
  };
}
