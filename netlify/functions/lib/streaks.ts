import type { PoolClient } from 'pg';
import {
  buildStreakStatus,
  calculateStreakProjection,
  StreakStatus,
} from '../../../shared/streak';
import { queryWithClient } from './db';

interface ResultDateRow {
  quiz_date: string;
}

export async function recomputeUserStreak(
  client: PoolClient,
  userId: string,
  asOfQuizDate: string
): Promise<StreakStatus> {
  const rows = await queryWithClient<ResultDateRow>(
    client,
    `SELECT DISTINCT quiz_date::TEXT as quiz_date
     FROM results
     WHERE user_id = $1
     ORDER BY quiz_date DESC`,
    [userId]
  );

  const projection = calculateStreakProjection(rows.map((row) => row.quiz_date));

  await queryWithClient(
    client,
    `UPDATE users
     SET streak = $2, last_played = $3::DATE
     WHERE id = $1`,
    [userId, projection.runLength, projection.lastPlayedDate]
  );

  return buildStreakStatus(projection, asOfQuizDate);
}
