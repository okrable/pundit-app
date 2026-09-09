export type JourneyOutcome = 'solved' | 'given_up';
export function isJourneyOutcome(value: unknown): value is JourneyOutcome {
  return value === 'solved' || value === 'given_up';
}
export function journeyShare(date: string, outcome: JourneyOutcome) {
  return `Pundit Journey — ${date}\n${outcome === 'solved' ? 'Player found ✅' : 'Answer revealed 🏳️'}\nhttps://pundittrivia.com/`;
}
export function legacyJourneyVisibility(outcome: JourneyOutcome, version: number) {
  return version === 2 || outcome === 'solved';
}
