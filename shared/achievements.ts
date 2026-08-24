export const ACHIEVEMENT_SCHEMA_VERSION = 1;
export const ACHIEVEMENT_EVALUATOR_VERSION = 1;

export const ACHIEVEMENT_IDS = [
  'debut',
  'sharpshooter',
  'top-bins',
  'dedication',
  'veteran',
  'stoppage-time',
  'comeback-king',
  'fashion-show',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  hint: string;
  icon: string;
  secret: boolean;
  target?: number;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'debut', title: 'Debut', description: 'Complete your first Daily Quiz.', hint: 'Every career starts somewhere.', icon: 'football', secret: false, target: 1 },
  { id: 'sharpshooter', title: 'Sharpshooter', description: 'Answer all five Daily Quiz questions correctly.', hint: 'Hit every target.', icon: 'locate', secret: false },
  { id: 'top-bins', title: 'Top Bins', description: 'Score a perfect 500 points in the Daily Quiz.', hint: 'Accuracy at full speed.', icon: 'trophy', secret: false },
  { id: 'dedication', title: 'Dedication', description: 'Build a seven-day Daily Quiz streak.', hint: 'Turn up every day.', icon: 'flame', secret: false, target: 7 },
  { id: 'veteran', title: 'Veteran', description: 'Complete 30 Daily Quizzes.', hint: 'Experience counts.', icon: 'ribbon', secret: false, target: 30 },
  { id: 'stoppage-time', title: 'Stoppage Time', description: 'Get a correct answer after the clock reaches zero.', hint: 'It is never over until it is over.', icon: 'time', secret: true },
  { id: 'comeback-king', title: 'Comeback King', description: 'Recover from two misses by answering the final three correctly.', hint: 'Turn the match around.', icon: 'trending-up', secret: true },
  { id: 'fashion-show', title: 'Fashion Show', description: 'Change your avatar three times in one day.', hint: 'Try a few different looks.', icon: 'shirt', secret: true },
] as const;

export interface AchievementUnlock {
  id: AchievementId;
  unlockedAt: string;
  sourceEventId: string;
}

export interface PublicAchievementUnlock {
  id: AchievementId;
  unlockedAt: string;
}

export function projectPublicAchievementUnlocks(
  unlocks: readonly ({ achievementId: unknown; unlockedAt: string } & Record<string, unknown>)[]
): PublicAchievementUnlock[] {
  return unlocks
    .filter((unlock): unlock is { achievementId: AchievementId; unlockedAt: string } =>
      isAchievementId(unlock.achievementId)
    )
    .map((unlock) => ({ id: unlock.achievementId, unlockedAt: unlock.unlockedAt }));
}

export interface AchievementProgress {
  dailyCompletions: number;
  dailyStreak: number;
  lastDailyDate: string | null;
  avatarChangeDate: string | null;
  avatarChangesToday: number;
}

export interface AchievementSnapshot {
  schemaVersion: number;
  evaluatorVersion: number;
  progress: AchievementProgress;
  unlocked: Partial<Record<AchievementId, AchievementUnlock>>;
  celebratedIds: AchievementId[];
}

export interface DailyQuizAchievementEvent {
  id: string;
  kind: 'daily-quiz';
  occurredAt: string;
  quizDate: string;
  quizId: string;
  score: number;
  answersCorrect: boolean[];
  correctAtZero: boolean;
  allowCumulative: boolean;
}

export interface AvatarChangeAchievementEvent {
  id: string;
  kind: 'avatar-change';
  occurredAt: string;
  quizDate: string;
  allowCumulative: true;
}

export type AchievementEvent = DailyQuizAchievementEvent | AvatarChangeAchievementEvent;

export interface AchievementSyncEnvelope {
  evaluatorVersion: number;
  eventId: string;
  proposedUnlockIds: AchievementId[];
  acknowledgedIds: AchievementId[];
}

export interface AchievementEvaluation {
  snapshot: AchievementSnapshot;
  newlyUnlocked: AchievementId[];
}

export function createEmptyAchievementSnapshot(): AchievementSnapshot {
  return {
    schemaVersion: ACHIEVEMENT_SCHEMA_VERSION,
    evaluatorVersion: ACHIEVEMENT_EVALUATOR_VERSION,
    progress: {
      dailyCompletions: 0,
      dailyStreak: 0,
      lastDailyDate: null,
      avatarChangeDate: null,
      avatarChangesToday: 0,
    },
    unlocked: {},
    celebratedIds: [],
  };
}

function isPreviousDate(previous: string, current: string): boolean {
  const previousDate = new Date(`${previous}T00:00:00Z`);
  const currentDate = new Date(`${current}T00:00:00Z`);
  return Number.isFinite(previousDate.getTime()) &&
    Number.isFinite(currentDate.getTime()) &&
    currentDate.getTime() - previousDate.getTime() === 86_400_000;
}

export function getAchievementProgress(
  snapshot: AchievementSnapshot,
  id: AchievementId
): { current: number; target: number } | null {
  if (id === 'debut') return { current: Math.min(snapshot.progress.dailyCompletions, 1), target: 1 };
  if (id === 'dedication') return { current: Math.min(snapshot.progress.dailyStreak, 7), target: 7 };
  if (id === 'veteran') return { current: Math.min(snapshot.progress.dailyCompletions, 30), target: 30 };
  return null;
}

export function applyAchievementEvent(
  current: AchievementSnapshot,
  event: AchievementEvent
): AchievementEvaluation {
  const snapshot: AchievementSnapshot = {
    ...current,
    schemaVersion: ACHIEVEMENT_SCHEMA_VERSION,
    evaluatorVersion: ACHIEVEMENT_EVALUATOR_VERSION,
    progress: { ...current.progress },
    unlocked: { ...current.unlocked },
    celebratedIds: [...current.celebratedIds],
  };
  const eligible = new Set<AchievementId>();

  if (event.kind === 'daily-quiz') {
    snapshot.progress.dailyCompletions += 1;
    if (event.allowCumulative) {
      if (snapshot.progress.lastDailyDate === event.quizDate) {
        // Idempotency is normally handled by event receipts; do not advance twice defensively.
      } else if (
        snapshot.progress.lastDailyDate &&
        isPreviousDate(snapshot.progress.lastDailyDate, event.quizDate)
      ) {
        snapshot.progress.dailyStreak += 1;
      } else {
        snapshot.progress.dailyStreak = 1;
      }
      snapshot.progress.lastDailyDate = event.quizDate;
    }

    eligible.add('debut');
    if (event.answersCorrect.length === 5 && event.answersCorrect.every(Boolean)) eligible.add('sharpshooter');
    if (event.score === 500) eligible.add('top-bins');
    if (event.correctAtZero) eligible.add('stoppage-time');
    if (
      event.answersCorrect.length === 5 &&
      !event.answersCorrect[0] &&
      !event.answersCorrect[1] &&
      event.answersCorrect.slice(2).every(Boolean)
    ) eligible.add('comeback-king');
    if (event.allowCumulative && snapshot.progress.dailyStreak >= 7) eligible.add('dedication');
    if (event.allowCumulative && snapshot.progress.dailyCompletions >= 30) eligible.add('veteran');
  } else {
    if (snapshot.progress.avatarChangeDate === event.quizDate) {
      snapshot.progress.avatarChangesToday += 1;
    } else {
      snapshot.progress.avatarChangeDate = event.quizDate;
      snapshot.progress.avatarChangesToday = 1;
    }
    if (snapshot.progress.avatarChangesToday >= 3) eligible.add('fashion-show');
  }

  const newlyUnlocked: AchievementId[] = [];
  for (const id of ACHIEVEMENT_IDS) {
    if (!eligible.has(id) || snapshot.unlocked[id]) continue;
    snapshot.unlocked[id] = { id, unlockedAt: event.occurredAt, sourceEventId: event.id };
    newlyUnlocked.push(id);
  }

  return { snapshot, newlyUnlocked };
}

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && ACHIEVEMENT_IDS.includes(value as AchievementId);
}
