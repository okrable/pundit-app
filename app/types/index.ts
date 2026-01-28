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

// Answer submitted with timing info
export interface AnswerWithTiming {
  questionId: string;
  selectedOptionIndex: number;
  timeRemainingMs: number;
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
  username: string | null;
  score: number;
  streak: number;
  rank: number;
}

export interface UserStats {
  streak: number;
  bestScore: number;
  totalQuizzes: number;
  accuracy: number;
  challengeWins: number;
  challengeLosses: number;
  challengeDraws: number;
  username: string | null;
  displayName: string | null;
  createdAt: string | null;
  canChangeUsername: boolean;
  usernameChangeAvailableAt: string | null;
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

// Username API types
export interface CheckUsernameResponse {
  available: boolean;
  error?: string;
}

export interface SetUsernameResponse {
  success: boolean;
  username?: string;
  error?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  profile?: {
    displayName: string | null;
    username: string | null;
  };
  error?: string;
}

// Challenge Mode Types
export interface ChallengeHistoryItem {
  challengeId: string;
  opponentDisplayName: string | null;
  opponentUsername: string | null;
  yourScore: number;
  opponentScore: number;
  result: 'win' | 'loss' | 'draw';
  completedAt: string;
}

export interface ChallengeStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface ActiveChallenge {
  challengeId: string;
  code: string;
  status: 'pending' | 'active';
  creatorDisplayName: string | null;
  creatorUsername: string | null;
  opponentDisplayName: string | null;
  opponentUsername: string | null;
  isCreator: boolean;
  createdAt: string;
  expiresAt: string;
  hasCreatorPlayed: boolean;
  hasOpponentPlayed: boolean;
}

export interface UserChallenges {
  active: ActiveChallenge | null;
  history: ChallengeHistoryItem[];
  stats: ChallengeStats;
}

export interface ChallengeAnswer {
  questionId: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
}

export interface ChallengeSubmitResult {
  status: 'waiting' | 'complete';
  yourScore: number;
  yourAnswers: ChallengeAnswer[];
  result?: 'win' | 'loss' | 'draw';
  opponentScore?: number;
  opponentDisplayName?: string;
  opponentAnswers?: ChallengeAnswer[];
}

export interface CreateChallengeResponse {
  challengeId: string;
  code: string;
  shareUrl: string;
  quizId: string;
  expiresAt: string;
  questions: Question[];
}

export interface JoinChallengeResponse {
  challengeId: string;
  creator: {
    displayName: string | null;
  };
  questions: Question[];
}

export interface GetChallengeResponse {
  challengeId: string;
  code: string;
  status: 'pending' | 'active' | 'completed' | 'expired' | 'revoked';
  creator: {
    displayName: string | null;
  };
  opponent: {
    displayName: string | null;
  } | null;
  canJoin: boolean;
  expiresAt: string;
}
