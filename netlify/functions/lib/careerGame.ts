import type { CareerGame } from '../../../app/types';
import {
  getCareerSourceRows,
  getQuestionSource,
} from './questionSource';

const CAREER_GAME_ID_PATTERN = /^career-(\d{4}-\d{2}-\d{2})$/;

export function getCurrentCareerGameDate(
  gameId: string,
  currentDate: string
): string | null {
  const match = CAREER_GAME_ID_PATTERN.exec(gameId);
  return match?.[1] === currentDate ? currentDate : null;
}

export async function getCareerGameForDate(
  date: string,
  language = 'uk'
): Promise<CareerGame | undefined> {
  if (getQuestionSource(date, language) === 'bigquery') {
    const source = await getCareerSourceRows(date, language);
    if (!source) {
      return undefined;
    }

    const canonicalName = source.question.player_name!.trim();
    const surname = canonicalName.split(/\s+/).at(-1);
    return {
      id: `career-${date}`,
      date,
      prompt: source.question.question!.trim(),
      canonicalName,
      acceptedAliases: [],
      acceptedSurnames: surname ? [surname] : [],
      career: source.career.map((row) => ({
        years: row.years!.trim(),
        team: row.team!.trim(),
        appearances: Number(row.appearances),
        goals: Number(row.goals),
        category: row.category!.trim(),
        rank: Number(row.rank),
      })),
    };
  }

  return {
    id: `career-${date}`,
    date,
    prompt:
      'Sold by Merseyside neighbours for a hefty fee, this direct winger earned England caps before a surprising Catalan move.',
    canonicalName: 'Anthony Gordon',
    acceptedAliases: [],
    acceptedSurnames: ['Gordon'],
    career: [
      {
        years: '2017–2023',
        team: 'Everton',
        appearances: 65,
        goals: 7,
        category: 'Domestic',
        rank: 1,
      },
      {
        years: '2021',
        team: '→ Preston North End (loan)',
        appearances: 11,
        goals: 0,
        category: 'Domestic',
        rank: 2,
      },
      {
        years: '2023–2026',
        team: 'Newcastle United',
        appearances: 111,
        goals: 24,
        category: 'Domestic',
        rank: 3,
      },
      {
        years: '2026–',
        team: 'Barcelona',
        appearances: 0,
        goals: 0,
        category: 'Domestic',
        rank: 4,
      },
    ],
  };
}
