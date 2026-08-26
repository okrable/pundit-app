export type QuizLayoutTier = 'comfortable' | 'compact' | 'accessibility';

export interface QuizLayoutInput {
  width: number;
  viewportHeight: number;
  fontScale: number;
}

export interface QuizLayoutPolicy {
  tier: QuizLayoutTier;
  quizTopPadding: number;
  quizBottomPadding: number;
  verticalGap: number;
  cardPadding: number;
  promptFontSize: number;
  promptLineHeight: number;
  optionMinHeight: number;
  optionPadding: number;
  hudMinHeight: number;
  logoWidth: number;
  logoHeight: number;
  useSingleColumnOptions: boolean;
}

export const QUIZ_OPTION_FADE_DURATION_MS = 300;
export const QUIZ_OPTION_STAGGER_DELAY_MS = 220;

export function getQuizOptionRevealDuration(optionCount: number): number {
  return QUIZ_OPTION_STAGGER_DELAY_MS * Math.max(optionCount - 1, 0) +
    QUIZ_OPTION_FADE_DURATION_MS;
}

export function shouldNotifyQuizOptionsReveal(
  questionId: string,
  notifiedQuestionId: string | null,
  isTypingComplete: boolean,
  optionsOffsetY: number | null
): boolean {
  return isTypingComplete && optionsOffsetY !== null && notifiedQuestionId !== questionId;
}

export function getQuizLayoutPolicy({
  width,
  viewportHeight,
  fontScale,
}: QuizLayoutInput): QuizLayoutPolicy {
  const accessibilityConstrained =
    viewportHeight < 620 || width < 350 || fontScale > 1.3;
  const compact =
    accessibilityConstrained ||
    viewportHeight < 720 ||
    width < 390 ||
    fontScale > 1.15;

  if (accessibilityConstrained) {
    return {
      tier: 'accessibility',
      quizTopPadding: 4,
      quizBottomPadding: 8,
      verticalGap: 8,
      cardPadding: 8,
      promptFontSize: 19,
      promptLineHeight: 25,
      optionMinHeight: 56,
      optionPadding: 8,
      hudMinHeight: 44,
      logoWidth: 72,
      logoHeight: 25,
      useSingleColumnOptions: true,
    };
  }

  if (compact) {
    return {
      tier: 'compact',
      quizTopPadding: 8,
      quizBottomPadding: 12,
      verticalGap: 8,
      cardPadding: 12,
      promptFontSize: 21,
      promptLineHeight: 28,
      optionMinHeight: 64,
      optionPadding: 8,
      hudMinHeight: 48,
      logoWidth: 80,
      logoHeight: 28,
      useSingleColumnOptions: false,
    };
  }

  return {
    tier: 'comfortable',
    quizTopPadding: 12,
    quizBottomPadding: 16,
    verticalGap: 12,
    cardPadding: 16,
    promptFontSize: 25,
    promptLineHeight: 32,
    optionMinHeight: 78,
    optionPadding: 12,
    hudMinHeight: 56,
    logoWidth: 92,
    logoHeight: 32,
    useSingleColumnOptions: false,
  };
}
