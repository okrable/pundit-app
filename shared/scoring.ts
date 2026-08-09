export function calculateQuizPoints(timeRemainingMs: number | undefined): number {
  if (timeRemainingMs === undefined) return 60;

  const seconds = timeRemainingMs / 1000;
  if (seconds >= 20) return 100;
  if (seconds >= 18) return 90;
  if (seconds >= 16) return 80;
  if (seconds >= 14) return 70;
  if (seconds >= 12) return 60;
  if (seconds >= 10) return 50;
  if (seconds >= 8) return 40;
  if (seconds >= 6) return 30;
  if (seconds >= 4) return 20;
  return 10;
}
