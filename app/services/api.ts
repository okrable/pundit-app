import {
  Quiz,
  QuizResult,
  QuizResultImmediate,
  GlobalLeaderboardResponse,
  LeaderboardEntry,
  LeaderboardPeriod,
  UserStats,
  UserProfile,
  AnswerWithTiming,
  CheckUsernameResponse,
  SetUsernameResponse,
  UpdateProfileResponse,
  CreateFriendLinkResponse,
  AcceptFriendLinkResponse,
  GetFriendsResponse,
  RemoveFriendResponse,
  FriendsLeaderboardResponse,
} from '../types';
import { useAuthStore } from '../state/useAuthStore';
import { logError, logInfo, logWarn } from './debugLog';
import { getQuizDate } from '../utils/quizDate';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8888/.netlify/functions';
const inflightRequests = new Map<string, Promise<unknown>>();
const API_TIMEOUT_MS = 8000;
const QUIZ_TIMEOUT_MS = 15000;
const SUBMIT_QUIZ_TIMEOUT_MS = 20000;
const LEADERBOARD_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestConfig {
  timeoutMs?: number;
}

async function executeFetch<T>(
  endpoint: string,
  options: RequestInit | undefined,
  timeoutMs: number,
  token: string | null,
  attempt: number
): Promise<T> {
  const method = options?.method ?? 'GET';
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  logInfo('api.request.start', {
    endpoint,
    method,
    hasToken: Boolean(token),
    attempt,
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('api.request.timeout', {
        url: `${API_BASE_URL}${endpoint}`,
        endpoint,
        method,
        durationMs: Date.now() - startedAt,
        attempt,
      });
      throw new ApiError(408, `Request timed out while loading ${endpoint}`);
    }

    logError('api.request.fetch_error', {
      endpoint,
      method,
      durationMs: Date.now() - startedAt,
      attempt,
      error,
    });
    throw error;
  }

  clearTimeout(timeout);
  logInfo('api.request.response', {
    endpoint,
    method,
    status: response.status,
    durationMs: Date.now() - startedAt,
    attempt,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    logWarn('api.request.not_ok', {
      endpoint,
      method,
      status: response.status,
      attempt,
      error: error.error || error.message || 'Request failed',
    });
    throw new ApiError(response.status, error.error || error.message || 'Request failed');
  }

  try {
    const data = await response.json();
    logInfo('api.request.success', {
      endpoint,
      method,
      durationMs: Date.now() - startedAt,
      attempt,
    });
    return data as T;
  } catch (error) {
    logError('api.request.parse_error', {
      endpoint,
      method,
      durationMs: Date.now() - startedAt,
      attempt,
      error,
    });
    throw error;
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  requestConfig?: ApiRequestConfig
): Promise<T> {
  const token = useAuthStore.getState().token;
  const method = options?.method ?? 'GET';
  const timeoutMs = requestConfig?.timeoutMs ?? API_TIMEOUT_MS;

  const requestKey =
    method === 'GET'
      ? `${method}:${endpoint}:${token ?? 'anonymous'}`
      : `${method}:${endpoint}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  const runRequest = async () => {
    try {
      return await executeFetch<T>(endpoint, options, timeoutMs, token, 1);
    } catch (error) {
      if (token && error instanceof ApiError && error.statusCode === 401) {
        const authState = useAuthStore.getState();
        const isSameToken = authState.token === token;
        if (!isSameToken) {
          logInfo('api.request.retry_with_current_token', {
            endpoint,
            method,
          });
          try {
            return await executeFetch<T>(endpoint, options, timeoutMs, authState.token, 2);
          } catch (retryError) {
            if (retryError instanceof ApiError && retryError.statusCode === 401) {
              useAuthStore.getState().requireReauth('Session expired. Sign in again to refresh.');
              throw new ApiError(401, 'Session needs re-authentication');
            }
            throw retryError;
          }
        }

        const refreshed = await authState.refreshToken();
        const refreshedToken = useAuthStore.getState().token;
        if (refreshed && refreshedToken && refreshedToken !== token) {
          logInfo('api.request.retry_after_refresh', {
            endpoint,
            method,
          });
          try {
            return await executeFetch<T>(endpoint, options, timeoutMs, refreshedToken, 2);
          } catch (retryError) {
            if (retryError instanceof ApiError && retryError.statusCode === 401) {
              useAuthStore.getState().requireReauth('Session expired. Sign in again to refresh.');
              throw new ApiError(401, 'Session needs re-authentication');
            }
            throw retryError;
          }
        }

        logWarn('api.request.auth_refresh_failed', {
          endpoint,
          method,
        });
      }

      if (token && error instanceof ApiError && error.statusCode === 401) {
        throw new ApiError(401, 'Your session expired. Please sign in again.');
      }

      throw error;
    }
  };

  if (method === 'GET') {
    const existing = inflightRequests.get(requestKey);
    if (existing) {
      return existing as Promise<T>;
    }

    const request = runRequest().finally(() => {
      inflightRequests.delete(requestKey);
    });
    inflightRequests.set(requestKey, request);
    return request;
  }

  return runRequest();
}

export async function getDailyQuiz(date?: string): Promise<Quiz> {
  const params = date ? `?date=${date}` : '';
  return fetchApi<Quiz>(`/getDailyQuiz${params}`, undefined, {
    timeoutMs: QUIZ_TIMEOUT_MS,
  });
}

function getCurrentWeekBounds(referenceDate: Date = new Date()): { weekStart: string; weekEnd: string } {
  const quizDate = getQuizDate(referenceDate);
  const [year, month, day] = quizDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekStartDate = new Date(utcDate);
  weekStartDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

  return {
    weekStart: weekStartDate.toISOString().split('T')[0],
    weekEnd: weekEndDate.toISOString().split('T')[0],
  };
}

function normalizeLeaderboardEntry(
  entry: LeaderboardEntry,
  period: LeaderboardPeriod
): LeaderboardEntry {
  return {
    ...entry,
    score: Number(entry.score ?? 0),
    gamesPlayed: Number(entry.gamesPlayed ?? 1),
    streak: Number(entry.streak ?? 0),
    rank: Number(entry.rank ?? 0),
  };
}

function normalizeGlobalLeaderboardResponse(
  data: GlobalLeaderboardResponse | LeaderboardEntry[],
  period: LeaderboardPeriod
): GlobalLeaderboardResponse {
  if (Array.isArray(data)) {
    const quizDate = getQuizDate();
    const { weekStart, weekEnd } = getCurrentWeekBounds();
    return {
      period,
      quizDate,
      weekStart,
      weekEnd,
      leaderboard: data.map((entry) => normalizeLeaderboardEntry(entry, period)),
    };
  }

  return {
    ...data,
    period: data.period ?? period,
    leaderboard: data.leaderboard.map((entry) => normalizeLeaderboardEntry(entry, period)),
  };
}

function normalizeFriendsLeaderboardResponse(
  data: FriendsLeaderboardResponse,
  period: LeaderboardPeriod
): FriendsLeaderboardResponse {
  const quizDate = data.quizDate ?? getQuizDate();
  const { weekStart, weekEnd } = data.weekStart && data.weekEnd
    ? { weekStart: data.weekStart, weekEnd: data.weekEnd }
    : getCurrentWeekBounds();

  return {
    ...data,
    period: data.period ?? period,
    quizDate,
    weekStart,
    weekEnd,
    friendsPlayedThisWeek: data.friendsPlayedThisWeek ?? 0,
    leaderboard: data.leaderboard.map((entry) => ({
      ...entry,
      score: Number(entry.score ?? 0),
      gamesPlayed: Number(entry.gamesPlayed ?? (entry.hasPlayedToday ? 1 : 0)),
      streak: Number(entry.streak ?? 0),
      rank: entry.rank === null ? null : Number(entry.rank ?? 0),
      hasPlayedThisWeek: entry.hasPlayedThisWeek ?? entry.hasPlayedToday,
    })),
  };
}

export async function submitQuiz(
  quizId: string,
  userId: string,
  answers: AnswerWithTiming[],
  userProfile?: UserProfile
): Promise<QuizResultImmediate> {
  return fetchApi<QuizResultImmediate>(
    '/submitQuiz',
    {
      method: 'POST',
      body: JSON.stringify({ quizId, userId, answers, userProfile }),
    },
    {
      timeoutMs: SUBMIT_QUIZ_TIMEOUT_MS,
    }
  );
}

export interface FinalizeQuizStatsResponse {
  finalized: boolean;
  skipped?: boolean;
  streak?: number;
  bestScore?: number;
}

export async function finalizeQuizStats(
  quizId: string,
  userId: string,
  userProfile?: UserProfile
): Promise<FinalizeQuizStatsResponse> {
  return fetchApi<FinalizeQuizStatsResponse>('/submitQuizFinalizeStats', {
    method: 'POST',
    body: JSON.stringify({ quizId, userId, userProfile }),
  });
}

export async function getLeaderboard(
  period: LeaderboardPeriod = 'daily',
  limit = 100
): Promise<GlobalLeaderboardResponse> {
  const data = await fetchApi<GlobalLeaderboardResponse | LeaderboardEntry[]>(`/getLeaderboard?period=${period}&limit=${limit}`, undefined, {
    timeoutMs: LEADERBOARD_TIMEOUT_MS,
  });
  return normalizeGlobalLeaderboardResponse(data, period);
}

export async function getUserStats(userId: string): Promise<UserStats> {
  return fetchApi<UserStats>(`/getUserStats?userId=${userId}`);
}

export async function getTodayResult(userId: string): Promise<QuizResult | null> {
  const response = await fetchApi<{ result: QuizResult | null }>(`/getTodayResult?userId=${userId}`);
  return response.result;
}

export interface MigrateGuestResultResponse {
  migrated: boolean;
  message?: string;
  streak: number;
  bestScore: number;
}

export async function migrateGuestResult(
  userId: string,
  quizId: string,
  score: number,
  totalQuestions: number,
  answers: boolean[],
  userProfile?: UserProfile
): Promise<MigrateGuestResultResponse> {
  return fetchApi<MigrateGuestResultResponse>('/migrateGuestResult', {
    method: 'POST',
    body: JSON.stringify({ userId, quizId, score, totalQuestions, answers, userProfile }),
  });
}

// Username and Profile API functions

export async function checkUsername(username: string): Promise<CheckUsernameResponse> {
  return fetchApi<CheckUsernameResponse>(`/checkUsername?username=${encodeURIComponent(username)}`);
}

export async function setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
  return fetchApi<SetUsernameResponse>('/setUsername', {
    method: 'POST',
    body: JSON.stringify({ userId, username }),
  });
}

export async function updateProfile(
  userId: string,
  displayName: string
): Promise<UpdateProfileResponse> {
  return fetchApi<UpdateProfileResponse>('/updateProfile', {
    method: 'POST',
    body: JSON.stringify({ userId, displayName }),
  });
}

// Friends API functions

export async function createFriendLink(userId: string): Promise<CreateFriendLinkResponse> {
  return fetchApi<CreateFriendLinkResponse>('/createFriendLink', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function acceptFriendLink(
  code: string,
  userId: string
): Promise<AcceptFriendLinkResponse> {
  return fetchApi<AcceptFriendLinkResponse>('/acceptFriendLink', {
    method: 'POST',
    body: JSON.stringify({ code, userId }),
  });
}

export async function getFriends(userId: string): Promise<GetFriendsResponse> {
  return fetchApi<GetFriendsResponse>(`/getFriends?userId=${userId}`);
}

export async function removeFriend(
  userId: string,
  friendId: string
): Promise<RemoveFriendResponse> {
  return fetchApi<RemoveFriendResponse>('/removeFriend', {
    method: 'POST',
    body: JSON.stringify({ userId, friendId }),
  });
}

export async function getFriendsLeaderboard(
  userId: string,
  period: LeaderboardPeriod = 'daily'
): Promise<FriendsLeaderboardResponse> {
  const data = await fetchApi<FriendsLeaderboardResponse>(
    `/getFriendsLeaderboard?userId=${userId}&period=${period}`,
    undefined,
    {
      timeoutMs: LEADERBOARD_TIMEOUT_MS,
    }
  );
  return normalizeFriendsLeaderboardResponse(data, period);
}
