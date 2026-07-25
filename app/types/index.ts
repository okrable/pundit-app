import type { StreakStatus } from '../../shared/streak';

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
  statsRefreshAfterMs?: number;
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

export type LeaderboardPeriod = 'daily';

export interface PublicPlayer {
  userId: string;
  username: string;
  avatarUrl?: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  /** @deprecated Compatibility alias containing the username. */
  displayName: string | null;
  username: string | null;
  score: number;
  gamesPlayed: number;
  streak: number;
  rank: number;
}

export interface GlobalLeaderboardResponse {
  period: LeaderboardPeriod;
  quizDate: string;
  leaderboard: LeaderboardEntry[];
}

export interface UserStats {
  streak: number;
  streakStatus: StreakStatus;
  bestScore: number;
  totalQuizzes: number;
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
  code?: 'USERNAME_IMMUTABLE';
  error?: string;
}

export type IdentityOnboardingStatus = 'username_required' | 'complete';

export interface SyncIdentityResponse {
  username: string | null;
  usernameRequired: boolean;
  onboardingStatus: IdentityOnboardingStatus;
}

// Challenge Mode Types
export interface ChallengeHistoryItem {
  challengeId: string;
  /** @deprecated Compatibility alias containing username or a legacy label. */
  opponentDisplayName: string | null;
  opponentUsername: string | null;
  opponentLegacyLabel?: string | null;
  opponentIsLegacyGuest?: boolean;
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
  shareUrl?: string;
  status: 'pending' | 'active';
  /** @deprecated Compatibility alias containing username or a legacy label. */
  creatorDisplayName: string | null;
  creatorUsername: string | null;
  /** @deprecated Compatibility alias containing username or a legacy label. */
  opponentDisplayName: string | null;
  opponentUsername: string | null;
  creatorLegacyLabel?: string | null;
  opponentLegacyLabel?: string | null;
  creatorIsLegacyGuest?: boolean;
  opponentIsLegacyGuest?: boolean;
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
  /** @deprecated Compatibility alias containing username or a legacy label. */
  opponentDisplayName?: string;
  opponentUsername?: string | null;
  opponentLegacyLabel?: string | null;
  opponentIsLegacyGuest?: boolean;
  opponentAnswers?: ChallengeAnswer[];
  syncState?: SyncState;
}

export interface CreateChallengeResponse {
  challengeId: string;
  code: string;
  shareUrl: string;
  quizId: string;
  expiresAt: string;
  questions: Question[];
  creatorUsername: string;
  /** @deprecated Compatibility alias containing the username. */
  creatorDisplayName: string;
}

export interface JoinChallengeResponse {
  challengeId: string;
  creator: {
    userId: string;
    username: string | null;
    legacyLabel?: string | null;
    isLegacyGuest?: boolean;
    /** @deprecated Compatibility alias containing username or a legacy label. */
    displayName: string | null;
  };
  creatorUsername: string | null;
  opponentUsername: string;
  questions: Question[];
}

export interface GetChallengeResponse {
  challengeId: string;
  code: string;
  status: 'pending' | 'active' | 'completed' | 'expired' | 'revoked';
  creator: {
    userId: string;
    username: string | null;
    legacyLabel?: string | null;
    isLegacyGuest?: boolean;
    /** @deprecated Compatibility alias containing username or a legacy label. */
    displayName: string | null;
  };
  opponent: {
    userId: string;
    username: string | null;
    legacyLabel?: string | null;
    isLegacyGuest?: boolean;
    /** @deprecated Compatibility alias containing username or a legacy label. */
    displayName: string | null;
  } | null;
  creatorUsername: string | null;
  opponentUsername: string | null;
  canJoin: boolean;
  expiresAt: string;
}

// Friends & Personal Leaderboard Types
export interface Friend {
  userId: string;
  /** @deprecated Compatibility alias for userId. */
  id: string;
  /** @deprecated Compatibility alias containing the username. */
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  streak: number;
  friendSince: string;
}

export interface FriendsLeaderboardEntry {
  userId: string;
  /** @deprecated Compatibility alias containing the username. */
  displayName: string | null;
  username: string | null;
  score: number;
  gamesPlayed: number;
  streak: number;
  rank: number | null;
  hasPlayedToday: boolean;
}

export interface FriendsLeaderboardResponse {
  period: LeaderboardPeriod;
  quizDate: string;
  leaderboard: FriendsLeaderboardEntry[];
  totalFriends: number;
  friendsPlayedToday: number;
}

export interface CreateFriendLinkResponse {
  code: string;
  shareUrl: string;
  expiresAt: string;
  reused: boolean;
  username: string;
}

export interface AcceptFriendLinkResponse {
  success: boolean;
  alreadyFriends?: boolean;
  friend?: PublicPlayer;
  friendId?: string;
  /** @deprecated Compatibility alias containing the username. */
  friendDisplayName?: string | null;
  friendUsername?: string | null;
  error?: string;
}

export interface GetFriendsResponse {
  friends: Friend[];
}

export interface RemoveFriendResponse {
  success: boolean;
  friendId?: string;
  alreadyRemoved?: boolean;
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

export interface PendingChallengeSubmission {
  userId: string;
  challengeId: string;
  answers: AnswerWithTiming[];
  localResult: ChallengeSubmitResult;
  queuedAt: string;
}
