const DEFAULT_QUIZ_TIMEZONE = 'Europe/London';

export function getQuizTimezone(): string {
  return process.env.EXPO_PUBLIC_QUIZ_TIMEZONE || DEFAULT_QUIZ_TIMEZONE;
}

export function getQuizDate(referenceDate: Date = new Date()): string {
  const timezone = getQuizTimezone();

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(referenceDate);
  } catch (error) {
    console.error(`Invalid EXPO_PUBLIC_QUIZ_TIMEZONE: ${timezone}. Falling back to UTC.`, error);
    return referenceDate.toISOString().split('T')[0];
  }
}
