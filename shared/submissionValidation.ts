export interface SubmittedAnswer {
  questionId: string;
  selectedOptionIndex: number;
  timeRemainingMs?: number;
}

export function validateSubmittedAnswers(
  answers: unknown,
  options: { maxAnswers?: number; maxOptionIndex?: number; maxTimeRemainingMs?: number } = {}
): string | null {
  const {
    maxAnswers = 5,
    maxOptionIndex = 3,
    maxTimeRemainingMs = 20_000,
  } = options;

  if (!Array.isArray(answers)) {
    return 'answers must be an array';
  }

  if (answers.length === 0) {
    return 'At least one answer is required';
  }

  if (answers.length > maxAnswers) {
    return 'Too many answers submitted';
  }

  const seenQuestionIds = new Set<string>();

  for (const rawAnswer of answers) {
    const answer = rawAnswer as Partial<SubmittedAnswer> | null;
    if (!answer?.questionId || typeof answer.selectedOptionIndex !== 'number') {
      return 'Each answer must include questionId and selectedOptionIndex';
    }

    if (
      !Number.isInteger(answer.selectedOptionIndex) ||
      answer.selectedOptionIndex < 0 ||
      answer.selectedOptionIndex > maxOptionIndex
    ) {
      return `selectedOptionIndex must be an integer between 0 and ${maxOptionIndex}`;
    }

    if (
      answer.timeRemainingMs !== undefined &&
      (!Number.isFinite(answer.timeRemainingMs) ||
        answer.timeRemainingMs < 0 ||
        answer.timeRemainingMs > maxTimeRemainingMs)
    ) {
      return `timeRemainingMs must be between 0 and ${maxTimeRemainingMs}`;
    }

    if (seenQuestionIds.has(answer.questionId)) {
      return 'Duplicate questionId in answers';
    }

    seenQuestionIds.add(answer.questionId);
  }

  return null;
}
