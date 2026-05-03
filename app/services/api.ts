import {
  Quiz,
  QuizResult,
  QuizResultImmediate,
  LeaderboardEntry,
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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8888/.netlify/functions';
const inflightRequests = new Map<string, Promise<unknown>>();
const API_TIMEOUT_MS = 8000;
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

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  requestConfig?: ApiRequestConfig
): Promise<T> {
  // Get Auth0 token if user is authenticated
  const token = useAuthStore.getState().token;
  const method = options?.method ?? 'GET';
  const timeoutMs = requestConfig?.timeoutMs ?? API_TIMEOUT_MS;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const requestKey =
    method === 'GET'
      ? `${method}:${endpoint}:${token ?? 'anonymous'}`
      : `${method}:${endpoint}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  const runRequest = async () => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    logInfo('api.request.start', {
      endpoint,
      method,
      hasToken: Boolean(token),
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
          endpoint,
          method,
          durationMs: Date.now() - startedAt,
        });
        throw new ApiError(408, `Request timed out: ${endpoint}`);
      }

      logError('api.request.fetch_error', {
        endpoint,
        method,
        durationMs: Date.now() - startedAt,
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
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      logWarn('api.request.not_ok', {
        endpoint,
        method,
        status: response.status,
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
      });
      return data as T;
    } catch (error) {
      logError('api.request.parse_error', {
        endpoint,
        method,
        durationMs: Date.now() - startedAt,
        error,
      });
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
  return fetchApi<Quiz>(`/getDailyQuiz${params}`);
}

export async function submitQuiz(
  quizId: string,
  userId: string,
  answers: AnswerWithTiming[],
  userProfile?: UserProfile
): Promise<QuizResultImmediate> {
  return fetchApi<QuizResultImmediate>('/submitQuiz', {
    method: 'POST',
    body: JSON.stringify({ quizId, userId, answers, userProfile }),
  });
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

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return fetchApi<LeaderboardEntry[]>('/getLeaderboard', undefined, {
    timeoutMs: LEADERBOARD_TIMEOUT_MS,
  });
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
  userId: string
): Promise<FriendsLeaderboardResponse> {
  return fetchApi<FriendsLeaderboardResponse>(
    `/getFriendsLeaderboard?userId=${userId}`
  );
}
