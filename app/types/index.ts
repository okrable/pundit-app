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

// Detailed answer info returned immediately after quiz submission
export interface QuizAnswerDetail {
  questionId: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
}

// Result returned immediately after submitting (has detailed answers for display)
export interface QuizResultImmediate {
  date: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  streak: number;
  bestScore: number;
  answers: QuizAnswerDetail[];
}

// Result stored in DB/cache (compact boolean array)
export interface QuizResult {
  date: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  streak: number;
  bestScore: number;
  answers: boolean[];
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  score: number;
  streak: number;
  rank: number;
}

export interface UserStats {
  streak: number;
  bestScore: number;
  totalQuizzes: number;
  averageScore: number;
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}
