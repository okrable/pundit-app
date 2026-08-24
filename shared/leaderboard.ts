export type LeaderboardPeriod = 'daily' | 'weekly';
export type LeaderboardScope = 'global' | 'friends';

export interface LeaderboardDateWindow {
  quizDate: string;
  previousQuizDate: string;
  periodStart: string;
  periodEnd: string;
}

function parseIsoDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid leaderboard date: ${date}`);
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid leaderboard date: ${date}`);
  }
  return parsed;
}

function shiftIsoDate(date: string, days: number): string {
  const parsed = parseIsoDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function parseLeaderboardPeriod(value: string | undefined): LeaderboardPeriod {
  return value === 'weekly' ? 'weekly' : 'daily';
}

export function getLeaderboardDateWindow(
  quizDate: string,
  period: LeaderboardPeriod
): LeaderboardDateWindow {
  const parsed = parseIsoDate(quizDate);
  const previousQuizDate = shiftIsoDate(quizDate, -1);
  if (period === 'daily') {
    return {
      quizDate,
      previousQuizDate,
      periodStart: quizDate,
      periodEnd: quizDate,
    };
  }

  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7;
  const periodStart = shiftIsoDate(quizDate, -daysSinceMonday);
  return {
    quizDate,
    previousQuizDate,
    periodStart,
    periodEnd: shiftIsoDate(periodStart, 6),
  };
}

export function getLeaderboardDatasetKey(
  scope: LeaderboardScope,
  period: LeaderboardPeriod
): `${LeaderboardScope}:${LeaderboardPeriod}` {
  return `${scope}:${period}`;
}

export function getLeaderboardCachePartitionKey(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  anchor: string,
  userId?: string
): string {
  return `leaderboard_${scope}_${period}_${anchor}_${userId ?? 'public'}`;
}
