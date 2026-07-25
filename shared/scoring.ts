export function calculateQuizPoints(timeRemainingMs: number | undefined): number {
  if (timeRemainingMs === undefined) return 60;

  const seconds = timeRemainingMs / 1000;
  if (seconds >= 16) return 100;
  if (seconds >= 12) return 80;
  if (seconds >= 8) return 60;
  if (seconds >= 4) return 40;
  return 20;
}
