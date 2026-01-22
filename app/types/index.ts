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

export interface QuizResult {
  date: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  streak: number;
  bestScore: number;
  answers: boolean[];  // Array of correct/incorrect booleans
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
