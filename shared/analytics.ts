export const ANALYTICS_EVENT_NAMES = [
  'app_shell_ready',
  'app_ready',
  'today_viewed',
  'quiz_start_requested',
  'quiz_first_question_ready',
  'quiz_started',
  'quiz_question_answered',
  'quiz_attempt_resumed',
  'quiz_abandoned',
  'quiz_completed',
  'quiz_recap_viewed',
  'quiz_shared',
  'journey_started',
  'archive_opened',
  'archive_quiz_started',
  'archive_quiz_completed',
  'auth_completed',
  'username_onboarding_shown',
  'username_onboarding_completed',
  'challenge_created',
  'challenge_joined',
  'challenge_submitted',
  'leaderboard_viewed',
  'leaderboard_filter_changed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsActorType = 'guest' | 'authenticated';
export type AnalyticsContentSource = 'cache' | 'network' | 'unknown';
export type AnalyticsExitReason = 'screen_exit' | 'app_backgrounded' | 'unknown';
export type AnalyticsLeaderboardScope = 'global' | 'friends';
export type AnalyticsLeaderboardPeriod = 'daily' | 'weekly';

export interface AnalyticsProperties {
  quizDate?: string;
  source?: AnalyticsContentSource;
  durationMs?: number;
  questionNumber?: number;
  totalQuestions?: number;
  score?: number;
  exitReason?: AnalyticsExitReason;
  leaderboardScope?: AnalyticsLeaderboardScope;
  leaderboardPeriod?: AnalyticsLeaderboardPeriod;
}

export const ANALYTICS_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const EVENT_NAMES = new Set<string>(ANALYTICS_EVENT_NAMES);
const CONTENT_SOURCES = new Set<AnalyticsContentSource>([
  'cache',
  'network',
  'unknown',
]);
const EXIT_REASONS = new Set<AnalyticsExitReason>([
  'screen_exit',
  'app_backgrounded',
  'unknown',
]);

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && EVENT_NAMES.has(value);
}

export function isAnalyticsId(value: unknown): value is string {
  return typeof value === 'string' && ANALYTICS_ID_PATTERN.test(value);
}

export function isAnalyticsActorType(value: unknown): value is AnalyticsActorType {
  return value === 'guest' || value === 'authenticated';
}

export function normalizeAnalyticsProperties(
  value: unknown
): AnalyticsProperties | null {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'quizDate',
    'source',
    'durationMs',
    'questionNumber',
    'totalQuestions',
    'score',
    'exitReason',
    'leaderboardScope',
    'leaderboardPeriod',
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) return null;

  const output: AnalyticsProperties = {};
  if (input.quizDate !== undefined) {
    if (typeof input.quizDate !== 'string' || !ISO_DATE_PATTERN.test(input.quizDate)) {
      return null;
    }
    output.quizDate = input.quizDate;
  }
  if (input.source !== undefined) {
    if (!CONTENT_SOURCES.has(input.source as AnalyticsContentSource)) return null;
    output.source = input.source as AnalyticsContentSource;
  }
  if (input.exitReason !== undefined) {
    if (!EXIT_REASONS.has(input.exitReason as AnalyticsExitReason)) return null;
    output.exitReason = input.exitReason as AnalyticsExitReason;
  }
  if (input.leaderboardScope !== undefined) {
    if (input.leaderboardScope !== 'global' && input.leaderboardScope !== 'friends') return null;
    output.leaderboardScope = input.leaderboardScope;
  }
  if (input.leaderboardPeriod !== undefined) {
    if (input.leaderboardPeriod !== 'daily' && input.leaderboardPeriod !== 'weekly') return null;
    output.leaderboardPeriod = input.leaderboardPeriod;
  }

  for (const key of ['durationMs', 'questionNumber', 'totalQuestions', 'score'] as const) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return null;
    output[key] = raw;
  }

  if ((output.durationMs ?? 0) > 10 * 60 * 1000) return null;
  if ((output.questionNumber ?? 0) > 100) return null;
  if ((output.totalQuestions ?? 0) > 100) return null;
  if ((output.score ?? 0) > 100000) return null;

  return output;
}
