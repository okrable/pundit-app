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

export interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
  staleAt: string;
  expiresAt: string | null;
  version: number;
  scopeKey?: string;
}

export type SyncState = 'pending' | 'synced' | 'failed';

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
  statsPending?: boolean;
  syncState?: SyncState;
  isOptimistic?: boolean;
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
  syncState?: SyncState;
}

export type LeaderboardPeriod = 'daily' | 'weekly';

export interface LeaderboardEntry {
  userId: string;
  username: string | null;
  score: number;
  gamesPlayed: number;
  streak: number;
  rank: number;
}

export interface GlobalLeaderboardResponse {
  period: LeaderboardPeriod;
  quizDate: string;
  weekStart: string;
  weekEnd: string;
  leaderboard: LeaderboardEntry[];
}

export interface UserStats {
  streak: number;
  bestScore: number;
  totalQuizzes: number;
  challengeWins: number;
  challengeLosses: number;
  challengeDraws: number;
  username: string | null;
  createdAt: string | null;
}

export interface UserProfile {
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

// Challenge Mode Types
export interface ChallengeHistoryItem {
  challengeId: string;
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
  creatorUsername: string | null;
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
  opponentUsername?: string | null;
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
    username: string | null;
  };
  questions: Question[];
}

export interface GetChallengeResponse {
  challengeId: string;
  code: string;
  status: 'pending' | 'active' | 'completed' | 'expired' | 'revoked';
  creator: {
    username: string | null;
  };
  opponent: {
    username: string | null;
  } | null;
  canJoin: boolean;
  expiresAt: string;
}

// Friends & Personal Leaderboard Types
export interface Friend {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  streak: number;
  friendSince: string;
}

export interface FriendsLeaderboardEntry {
  userId: string;
  username: string | null;
  score: number;
  gamesPlayed: number;
  streak: number;
  rank: number | null;
  hasPlayedToday: boolean;
  hasPlayedThisWeek?: boolean;
}

export interface FriendsLeaderboardResponse {
  period: LeaderboardPeriod;
  quizDate: string;
  weekStart: string;
  weekEnd: string;
  leaderboard: FriendsLeaderboardEntry[];
  totalFriends: number;
  friendsPlayedToday: number;
  friendsPlayedThisWeek: number;
}

export interface CreateFriendLinkResponse {
  code: string;
  shareUrl: string;
  expiresAt: string;
}

export interface AcceptFriendLinkResponse {
  success: boolean;
  friendId?: string;
  friendUsername?: string | null;
  error?: string;
}

export interface GetFriendsResponse {
  friends: Friend[];
}

export interface RemoveFriendResponse {
  success: boolean;
  error?: string;
}

export interface PendingQuizSubmission {
  userId: string;
  quizId: string;
  answers: AnswerWithTiming[];
  userProfile?: UserProfile;
  localResult: QuizResultImmediate;
  queuedAt: string;
}
