import { useAuthStore } from '../state/useAuthStore';
import type {
  UserChallenges,
  CreateChallengeResponse,
  JoinChallengeResponse,
  GetChallengeResponse,
  ChallengeSubmitResult,
  AnswerWithTiming,
} from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8888/.netlify/functions';

class ChallengeApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ChallengeApiError';
  }
}

async function fetchChallengeApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ChallengeApiError(response.status, error.error || error.message || 'Request failed');
  }

  return response.json();
}

export const challengeApi = {
  async createChallenge(userId: string, displayName?: string): Promise<CreateChallengeResponse> {
    return fetchChallengeApi<CreateChallengeResponse>('/createChallenge', {
      method: 'POST',
      body: JSON.stringify({ userId, displayName }),
    });
  },

  async getChallenge(code: string): Promise<GetChallengeResponse> {
    return fetchChallengeApi<GetChallengeResponse>(`/getChallenge?code=${code}`);
  },

  async joinChallenge(code: string, userId: string, displayName?: string): Promise<JoinChallengeResponse> {
    return fetchChallengeApi<JoinChallengeResponse>('/joinChallenge', {
      method: 'POST',
      body: JSON.stringify({ code, userId, displayName }),
    });
  },

  async submitAnswers(
    challengeId: string,
    userId: string,
    answers: AnswerWithTiming[]
  ): Promise<ChallengeSubmitResult> {
    return fetchChallengeApi<ChallengeSubmitResult>('/submitChallengeAnswers', {
      method: 'POST',
      body: JSON.stringify({ challengeId, userId, answers }),
    });
  },

  async revokeChallenge(challengeId: string, userId: string): Promise<void> {
    await fetchChallengeApi<{ success: boolean }>('/revokeChallenge', {
      method: 'POST',
      body: JSON.stringify({ challengeId, userId }),
    });
  },

  async getUserChallenges(userId: string): Promise<UserChallenges> {
    return fetchChallengeApi<UserChallenges>(`/getUserChallenges?userId=${userId}`);
  },
};

export { ChallengeApiError };
