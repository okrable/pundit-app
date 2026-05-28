const DEFAULT_QUIZ_TIMEZONE = 'Europe/London';

function resolveQuizTimezone(): string {
  return process.env.QUIZ_TIMEZONE || DEFAULT_QUIZ_TIMEZONE;
}

export function getQuizDate(referenceDate: Date = new Date()): string {
  const timezone = resolveQuizTimezone();

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(referenceDate);
  } catch (error) {
    console.error(`Invalid QUIZ_TIMEZONE: ${timezone}. Falling back to UTC.`, error);
    return referenceDate.toISOString().split('T')[0];
  }
}

export function getPreviousQuizDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  return utcDate.toISOString().split('T')[0];
}

export function getCurrentQuizWeekBounds(referenceDate: Date = new Date()): {
  weekStart: string;
  weekEnd: string;
} {
  const quizDate = getQuizDate(referenceDate);
  const [year, month, day] = quizDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const weekStartDate = new Date(utcDate);
  weekStartDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

  return {
    weekStart: weekStartDate.toISOString().split('T')[0],
    weekEnd: weekEndDate.toISOString().split('T')[0],
  };
}
