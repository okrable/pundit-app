import type { CareerGame, Question, Quiz } from '../../../app/types';

export interface DailyQuizQuestionRow {
  question_id: string;
  question: string | null;
  player_name: string | null;
  player_0: string | null;
  player_1: string | null;
  player_2: string | null;
  player_3: string | null;
}

export function buildDailyQuizResponse(
  targetDate: string,
  questions: DailyQuizQuestionRow[],
  careerGame?: CareerGame
): Quiz {
  return {
    id: `quiz-${targetDate}`,
    date: targetDate,
    questions: formatDailyQuizQuestions(questions),
    ...(careerGame ? { careerGame } : {}),
  };
}

export function formatDailyQuizQuestions(
  questions: DailyQuizQuestionRow[]
): Question[] {
  return questions.map((question) => {
    const options = [
      question.player_0,
      question.player_1,
      question.player_2,
      question.player_3,
    ].filter((option): option is string => Boolean(option));
    const correctIndex = options.findIndex(
      (option) => option === question.player_name
    );

    return {
      id: question.question_id,
      prompt: question.question || '',
      options,
      correctOptionIndex: correctIndex >= 0 ? correctIndex : undefined,
    };
  });
}
