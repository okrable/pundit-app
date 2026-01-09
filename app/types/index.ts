export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex?: number;
}

export interface Quiz {
  id: string;
  date: string;
  questions: Question[];
}

export interface QuizAnswer {
  questionId: string;
  selectedOptionIndex: number;
  correctOptionIndex?: number;
  isCorrect?: boolean;
}

export interface QuizResult {
  date: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  streak: number;
  bestScore: number;
  answers: QuizAnswer[];
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  score: number;
  streak: number;
}

export interface UserStats {
  streak: number;
  bestScore: number;
}
