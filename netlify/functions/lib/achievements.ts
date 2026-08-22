import type { PoolClient } from 'pg';
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENT_EVALUATOR_VERSION,
  AchievementEvent,
  AchievementId,
  AchievementSnapshot,
  AchievementSyncEnvelope,
  applyAchievementEvent,
  createEmptyAchievementSnapshot,
  isAchievementId,
} from '../../../shared/achievements';
import { queryWithClient } from './db';

interface ProgressRow {
  daily_completions: number;
  daily_streak: number;
  last_daily_date: string | null;
  avatar_change_date: string | null;
  avatar_changes_today: number;
}

interface UnlockRow {
  achievement_id: string;
  unlocked_at: string;
  source_event_id: string;
  celebrated_at: string | null;
}

export interface ServerAchievementResult {
  snapshot: AchievementSnapshot;
  newlyUnlocked: AchievementId[];
  rejectedProposedIds: AchievementId[];
}

export async function getServerAchievementSnapshot(
  client: PoolClient,
  userId: string
): Promise<AchievementSnapshot> {
  const [progressRows, unlockRows] = await Promise.all([
    queryWithClient<ProgressRow>(
      client,
      `SELECT
         daily_completions,
         daily_streak,
         last_daily_date::TEXT AS last_daily_date,
         avatar_change_date::TEXT AS avatar_change_date,
         avatar_changes_today
       FROM user_achievement_progress
       WHERE user_id = $1`,
      [userId]
    ),
    queryWithClient<UnlockRow>(
      client,
      `SELECT
         achievement_id,
         unlocked_at::TEXT AS unlocked_at,
         source_event_id,
         celebrated_at::TEXT AS celebrated_at
       FROM user_achievements
       WHERE user_id = $1
       ORDER BY unlocked_at ASC`,
      [userId]
    ),
  ]);

  const snapshot = createEmptyAchievementSnapshot();
  const progress = progressRows[0];
  if (progress) {
    snapshot.progress = {
      dailyCompletions: Number(progress.daily_completions || 0),
      dailyStreak: Number(progress.daily_streak || 0),
      lastDailyDate: progress.last_daily_date,
      avatarChangeDate: progress.avatar_change_date,
      avatarChangesToday: Number(progress.avatar_changes_today || 0),
    };
  }

  for (const row of unlockRows) {
    if (!isAchievementId(row.achievement_id)) continue;
    snapshot.unlocked[row.achievement_id] = {
      id: row.achievement_id,
      unlockedAt: row.unlocked_at,
      sourceEventId: row.source_event_id,
    };
    if (row.celebrated_at) snapshot.celebratedIds.push(row.achievement_id);
  }
  return snapshot;
}

export async function applyServerAchievementAcknowledgements(
  client: PoolClient,
  userId: string,
  acknowledgedIds: unknown
) {
  if (!Array.isArray(acknowledgedIds)) return;
  const validIds = acknowledgedIds.filter(isAchievementId);
  if (validIds.length === 0) return;
  await queryWithClient(
    client,
    `UPDATE user_achievements
     SET celebrated_at = COALESCE(celebrated_at, now())
     WHERE user_id = $1 AND achievement_id = ANY($2)`,
    [userId, validIds]
  );
}

export async function applyServerAchievementEvent(
  client: PoolClient,
  userId: string,
  event: AchievementEvent,
  sync?: AchievementSyncEnvelope
): Promise<ServerAchievementResult> {
  await applyServerAchievementAcknowledgements(client, userId, sync?.acknowledgedIds);

  await queryWithClient(
    client,
    `INSERT INTO user_achievement_progress (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await queryWithClient(
    client,
    'SELECT user_id FROM user_achievement_progress WHERE user_id = $1 FOR UPDATE',
    [userId]
  );

  const receipt = await queryWithClient<{ event_id: string }>(
    client,
    `INSERT INTO achievement_sync_receipts (user_id, event_id, event_kind)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, event_id) DO NOTHING
     RETURNING event_id`,
    [userId, event.id, event.kind]
  );

  if (receipt.length === 0) {
    const snapshot = await getServerAchievementSnapshot(client, userId);
    return { snapshot, newlyUnlocked: [], rejectedProposedIds: [] };
  }

  const current = await getServerAchievementSnapshot(client, userId);
  const evaluation = applyAchievementEvent(current, event);
  const progress = evaluation.snapshot.progress;
  await queryWithClient(
    client,
    `UPSERT INTO user_achievement_progress (
       user_id,
       daily_completions,
       daily_streak,
       last_daily_date,
       avatar_change_date,
       avatar_changes_today,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [
      userId,
      progress.dailyCompletions,
      progress.dailyStreak,
      progress.lastDailyDate,
      progress.avatarChangeDate,
      progress.avatarChangesToday,
    ]
  );

  for (const id of evaluation.newlyUnlocked) {
    const unlock = evaluation.snapshot.unlocked[id];
    if (!unlock) continue;
    await queryWithClient(
      client,
      `INSERT INTO user_achievements (
         user_id, achievement_id, unlocked_at, source_event_id
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [userId, id, unlock.unlockedAt, unlock.sourceEventId]
    );
  }

  await applyServerAchievementAcknowledgements(client, userId, sync?.acknowledgedIds);

  const snapshot = await getServerAchievementSnapshot(client, userId);
  const proposed = Array.isArray(sync?.proposedUnlockIds)
    ? sync!.proposedUnlockIds.filter(isAchievementId)
    : [];
  const rejectedProposedIds = proposed.filter((id) => !snapshot.unlocked[id]);
  return {
    snapshot,
    newlyUnlocked: evaluation.newlyUnlocked.filter((id) => Boolean(snapshot.unlocked[id])),
    rejectedProposedIds,
  };
}

export async function getServerAchievementSnapshotForUser(
  client: PoolClient,
  userId: string
): Promise<AchievementSnapshot> {
  const snapshot = await getServerAchievementSnapshot(client, userId);
  snapshot.evaluatorVersion = ACHIEVEMENT_EVALUATOR_VERSION;
  return snapshot;
}

export function sanitizeAchievementIds(values: unknown): AchievementId[] {
  if (!Array.isArray(values)) return [];
  return ACHIEVEMENT_IDS.filter((id) => values.includes(id));
}
