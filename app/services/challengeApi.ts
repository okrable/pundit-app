import { ApiError, fetchApi } from './api';
import type {
  UserChallenges,
  CreateChallengeResponse,
  JoinChallengeResponse,
  GetChallengeResponse,
  ChallengeSubmitResult,
  AnswerWithTiming,
} from '../types';

const CHALLENGE_TIMEOUT_MS = 15000;
const CHALLENGE_SUBMIT_TIMEOUT_MS = 20000;

export const challengeApi = {
  async createChallenge(userId: string, username?: string | null): Promise<CreateChallengeResponse> {
    return fetchApi<CreateChallengeResponse>(
      '/createChallenge',
      {
        method: 'POST',
        body: JSON.stringify({ userId, username }),
      },
      { timeoutMs: CHALLENGE_TIMEOUT_MS }
    );
  },

  async getChallenge(code: string): Promise<GetChallengeResponse> {
    return fetchApi<GetChallengeResponse>(
      `/getChallenge?code=${code}`,
      undefined,
      { timeoutMs: CHALLENGE_TIMEOUT_MS }
    );
  },

  async joinChallenge(code: string, userId: string, username?: string | null): Promise<JoinChallengeResponse> {
    return fetchApi<JoinChallengeResponse>(
      '/joinChallenge',
      {
        method: 'POST',
        body: JSON.stringify({ code, userId, username }),
      },
      { timeoutMs: CHALLENGE_TIMEOUT_MS }
    );
  },

  async submitAnswers(
    challengeId: string,
    userId: string,
    answers: AnswerWithTiming[]
  ): Promise<ChallengeSubmitResult> {
    return fetchApi<ChallengeSubmitResult>(
      '/submitChallengeAnswers',
      {
        method: 'POST',
        body: JSON.stringify({ challengeId, userId, answers }),
      },
      { timeoutMs: CHALLENGE_SUBMIT_TIMEOUT_MS }
    );
  },

  async revokeChallenge(challengeId: string, userId: string): Promise<void> {
    await fetchApi<{ success: boolean }>(
      '/revokeChallenge',
      {
        method: 'POST',
        body: JSON.stringify({ challengeId, userId }),
      },
      { timeoutMs: CHALLENGE_TIMEOUT_MS }
    );
  },

  async getUserChallenges(userId: string): Promise<UserChallenges> {
    return fetchApi<UserChallenges>(
      `/getUserChallenges?userId=${userId}`,
      undefined,
      { timeoutMs: CHALLENGE_TIMEOUT_MS }
    );
  },
};

export { ApiError as ChallengeApiError };
