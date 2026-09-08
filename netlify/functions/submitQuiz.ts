import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient } from './lib/db';
import { calculateQuizPoints } from '../../shared/scoring';
import { validateSubmittedAnswers } from '../../shared/submissionValidation';
import { enforceRateLimit } from './lib/rateLimit';
import { requireCompletedIdentity } from './lib/identity';
import { getAnswerKeyRows, QuestionSourceError } from './lib/questionSource';
import type { AchievementSyncEnvelope, DailyQuizAchievementEvent } from '../../shared/achievements';
import { applyServerAchievementEvent, applyServerAchievementAcknowledgements, getServerAchievementSnapshotForUser } from './lib/achievements';
import { readQuizResult, serializeQuizResult, recomputeUserQuizStats, withUserResultTransaction } from './lib/quizResults';
import type { StoredQuizResult } from './lib/quizResults';
import type { QuizAnswerDetail } from '../../app/types';

interface SubmitQuizRequest {
  quizId: string; userId: string;
  answers: { questionId: string; selectedOptionIndex: number; timeRemainingMs?: number }[];
  achievementSync?: AchievementSyncEnvelope;
}
const defaultDependencies = { queryWithClient, enforceRateLimit, requireCompletedIdentity, getAnswerKeyRows,
  applyServerAchievementEvent, applyServerAchievementAcknowledgements, getServerAchievementSnapshotForUser,
  readQuizResult, recomputeUserQuizStats, withUserResultTransaction };
export function createSubmitQuizHandler(dependencies = defaultDependencies): LambdaHandler {
const { queryWithClient, enforceRateLimit, requireCompletedIdentity, getAnswerKeyRows,
  applyServerAchievementEvent, applyServerAchievementAcknowledgements, getServerAchievementSnapshotForUser,
  readQuizResult, recomputeUserQuizStats, withUserResultTransaction } = dependencies;
const handler: LambdaHandler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (statusCode: number, body: unknown) => ({ statusCode, headers, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return reply(200, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const { quizId, userId, answers, achievementSync } = JSON.parse(event.body || '{}') as SubmitQuizRequest;
    if (typeof quizId !== 'string' || !/^quiz-\d{4}-\d{2}-\d{2}$/.test(quizId) || typeof userId !== 'string' || !userId) return reply(400, { error: 'Invalid quiz/user' });
    const validationError = validateSubmittedAnswers(answers);
    if (validationError) return reply(400, { error: validationError });
    const isGuest = userId.startsWith('guest_');
    if (!isGuest) {
      const identity = await requireCompletedIdentity(event, userId, headers);
      if (identity.response) return identity.response;
    }
    const limited = await enforceRateLimit(event, headers, { scope: 'submit-quiz', subject: userId, limit: 8, windowSeconds: 300 });
    if (limited) return limited;
    const date = quizId.slice(5);
    const scoreSubmission = async (): Promise<StoredQuizResult> => {
      const keys = await getAnswerKeyRows(date, 'uk', answers.map(a => a.questionId));
      const details: QuizAnswerDetail[] = answers.map(answer => {
        const key = keys.find(row => row.question_id === answer.questionId);
        if (!key) throw new Error('Question unavailable');
        const options = [key.player_0, key.player_1, key.player_2, key.player_3];
        const correctOptionIndex = options.findIndex(option => option === key.player_name);
        if (correctOptionIndex < 0 || answer.selectedOptionIndex >= options.length) throw new Error('Invalid answer key');
        return { ...answer, correctOptionIndex, isCorrect: answer.selectedOptionIndex === correctOptionIndex };
      });
      return { quiz_date: date, quiz_id: quizId, total_questions: answers.length,
        score: details.reduce((sum, a) => sum + (a.isCorrect ? calculateQuizPoints(a.timeRemainingMs) : 0), 0),
        answers: details.map(a => a.isCorrect), answer_details: details };
    };
    if (isGuest) {
      const row = await scoreSubmission();
      return reply(200, { ...serializeQuizResult(row), streak: 1, bestScore: row.score });
    }
    const response = await withUserResultTransaction(userId, async client => {
      let row = await readQuizResult(client, userId, quizId);
      let inserted = false;
      if (!row) {
        const proposed = await scoreSubmission();
        const rows = await queryWithClient(client,
          `INSERT INTO results(user_id,quiz_id,quiz_date,score,total_questions,answers,answer_details)
           VALUES($1,$2,$3,$4,$5,$6,$7::JSONB) ON CONFLICT(user_id,quiz_id) DO NOTHING RETURNING id`,
          [userId,quizId,date,proposed.score,proposed.total_questions,proposed.answers,JSON.stringify(proposed.answer_details)]);
        inserted = rows.length > 0;
        row = await readQuizResult(client, userId, quizId);
      }
      if (!row) throw new Error('Canonical result unavailable');
      const stats = await recomputeUserQuizStats(client, userId);
      let snapshot;
      let newlyUnlocked: string[] = [];
      let rejectedProposedIds: string[] = [];
      if (inserted) {
        const achievementEvent: DailyQuizAchievementEvent = {
          id: `daily:${quizId}`, kind: 'daily-quiz', occurredAt: new Date().toISOString(),
          quizDate: date, quizId, score: Number(row.score), answersCorrect: row.answers,
          correctAtZero: row.answer_details?.some(a => a.isCorrect && a.timeRemainingMs === 0) ?? false,
          allowCumulative: true,
        };
        const applied = await applyServerAchievementEvent(client, userId, achievementEvent, achievementSync);
        snapshot = applied.snapshot; newlyUnlocked = applied.newlyUnlocked; rejectedProposedIds = applied.rejectedProposedIds;
      } else {
        await applyServerAchievementAcknowledgements(client, userId, achievementSync?.acknowledgedIds);
        snapshot = await getServerAchievementSnapshotForUser(client, userId);
      }
      return { ...serializeQuizResult(row), ...stats, achievementSnapshot: snapshot, newlyUnlockedAchievements: newlyUnlocked, rejectedAchievementIds: rejectedProposedIds };
    });
    return reply(200, response);
  } catch (error) {
    console.error('Quiz submission failed', { type: error instanceof Error ? error.name : 'unknown' });
    return reply(error instanceof SyntaxError ? 400 : error instanceof QuestionSourceError ? 503 : 500, { error: 'Unable to save quiz result' });
  }
};
return handler;
}
export default withLambda(createSubmitQuizHandler());
