import type { PoolClient } from 'pg';
import { queryWithClient } from './db';
import { withUserResultTransaction } from './quizResults';
import { getCareerGameForDate } from './careerGame';
import { getQuizDate } from './quizDate';
import { matchesCareerAnswer } from '../../../shared/careerAnswer';
import { legacyJourneyVisibility, type JourneyOutcome } from '../../../shared/journeyOutcome';

export interface JourneyRow {
  game_id: string; game_date: string; canonical_name: string; submitted_answer: string;
  outcome: JourneyOutcome;
}
export class JourneyResultError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function journeyResult(row: JourneyRow) {
  return { date: row.game_date, gameId: row.game_id, canonicalName: row.canonical_name,
    submittedAnswer: row.submitted_answer, completed: true as const, outcome: row.outcome,
    syncState: 'synced' as const };
}
export async function readJourneyResult(client: PoolClient, userId: string, gameId: string) {
  const rows = await queryWithClient<JourneyRow>(client,
    `SELECT game_id,game_date::TEXT AS game_date,canonical_name,submitted_answer,outcome
     FROM career_game_results WHERE user_id=$1 AND game_id=$2`, [userId,gameId]);
  return rows[0] ?? null;
}
const defaults = { transaction: withUserResultTransaction, read: readJourneyResult,
  query: queryWithClient, game: getCareerGameForDate, today: getQuizDate };
export async function persistJourneyOutcome(
  userId: string, gameId: string, outcome: JourneyOutcome, answer: string, version: number,
  dependencies = defaults
) {
  return dependencies.transaction(userId, async client => {
    let row = await dependencies.read(client,userId,gameId);
    if (!row) {
      const date = gameId.slice(7);
      if (gameId !== `career-${dependencies.today()}`) throw new JourneyResultError(400,'JOURNEY_EXPIRED');
      const game = await dependencies.game(date);
      if (!game) throw new JourneyResultError(503,'JOURNEY_UNAVAILABLE');
      if (outcome === 'solved' && !matchesCareerAnswer(answer,game)) throw new JourneyResultError(422,'INCORRECT_ANSWER');
      await dependencies.query(client,
        `INSERT INTO career_game_results(user_id,game_id,game_date,submitted_answer,canonical_name,outcome)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,game_id) DO NOTHING`,
        [userId,gameId,date,outcome === 'solved' ? answer.trim() : '',game.canonicalName,outcome]);
      row = await dependencies.read(client,userId,gameId);
    }
    if (!row) throw new JourneyResultError(503,'JOURNEY_RESULT_UNAVAILABLE');
    if (!legacyJourneyVisibility(row.outcome,version)) throw new JourneyResultError(409,'JOURNEY_ALREADY_FINISHED');
    return journeyResult(row);
  });
}
