export type StreakState = 'not_started' | 'active_today' | 'at_risk' | 'inactive';

export interface StreakProjection {
  runLength: number;
  lastPlayedDate: string | null;
}

export interface StreakStatus {
  current: number;
  state: StreakState;
  lastPlayedDate: string | null;
  asOfQuizDate: string;
}

function getPreviousDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  return utcDate.toISOString().split('T')[0];
}

export function calculateStreakProjection(quizDates: string[]): StreakProjection {
  const dates = [...new Set(quizDates)].sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) {
    return { runLength: 0, lastPlayedDate: null };
  }

  let runLength = 1;
  let expectedDate = dates[0];

  for (let index = 1; index < dates.length; index++) {
    expectedDate = getPreviousDate(expectedDate);
    if (dates[index] !== expectedDate) {
      break;
    }
    runLength++;
  }

  return {
    runLength,
    lastPlayedDate: dates[0],
  };
}

export function buildStreakStatus(
  projection: StreakProjection,
  asOfQuizDate: string
): StreakStatus {
  if (!projection.lastPlayedDate) {
    return {
      current: 0,
      state: 'not_started',
      lastPlayedDate: null,
      asOfQuizDate,
    };
  }

  if (projection.lastPlayedDate === asOfQuizDate) {
    return {
      current: projection.runLength,
      state: 'active_today',
      lastPlayedDate: projection.lastPlayedDate,
      asOfQuizDate,
    };
  }

  if (projection.lastPlayedDate === getPreviousDate(asOfQuizDate)) {
    return {
      current: projection.runLength,
      state: 'at_risk',
      lastPlayedDate: projection.lastPlayedDate,
      asOfQuizDate,
    };
  }

  return {
    current: 0,
    state: 'inactive',
    lastPlayedDate: projection.lastPlayedDate,
    asOfQuizDate,
  };
}

export function formatStreakLabel(streak: number): string {
  return `${streak} ${streak === 1 ? 'day' : 'days'} streak`;
}

export function projectStreakAfterPlay(status: StreakStatus): number {
  if (status.state === 'active_today') {
    return status.current;
  }

  if (status.state === 'at_risk') {
    return status.current + 1;
  }

  return 1;
}
