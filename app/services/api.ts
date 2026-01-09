import { Quiz, QuizResult, LeaderboardEntry, UserStats } from '../types';
import { useAuthStore } from '../state/useAuthStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8888/.netlify/functions';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get Auth0 token if user is authenticated
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || error.message || 'Request failed');
  }

  return response.json();
}

export async function getDailyQuiz(date?: string): Promise<Quiz> {
  const params = date ? `?date=${date}` : '';
  return fetchApi<Quiz>(`/getDailyQuiz${params}`);
}

export async function submitQuiz(
  quizId: string,
  userId: string,
  answers: { questionId: string; selectedOptionIndex: number }[]
): Promise<QuizResult> {
  return fetchApi<QuizResult>('/submitQuiz', {
    method: 'POST',
    body: JSON.stringify({ quizId, userId, answers }),
  });
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return fetchApi<LeaderboardEntry[]>('/getLeaderboard');
}

export async function getUserStats(userId: string): Promise<UserStats> {
  return fetchApi<UserStats>(`/getUserStats?userId=${userId}`);
}
