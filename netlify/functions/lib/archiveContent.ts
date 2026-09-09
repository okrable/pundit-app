import {
  getBigQueryClient,
  getBigQueryConfig,
  getBigQueryLocation,
  getQuestionSource,
  validateQuestionRows,
  type SourceQuestionRow,
} from './questionSource';
import { query } from './db';
import { formatDailyQuizQuestions } from './dailyQuizResponse';
import { getDailyQuizContentSignature } from '../../../shared/dailyQuizAttempt';
import { isArchiveDate, type ArchiveQuiz } from '../../../shared/archive';
interface DatedRow extends SourceQuestionRow {
  date: string | { value: string };
  generated_at?: string | { value: string };
}
export function buildArchiveCatalog(
  rows: DatedRow[],
  today: string,
  source: 'bigquery' | 'cockroach',
): ArchiveQuiz[] {
  const groups = new Map<string, DatedRow[]>();
  for (const row of rows) {
    const date = typeof row.date === 'string' ? row.date : row.date.value;
    if (!isArchiveDate(date, today) || getQuestionSource(date, 'uk') !== source)
      continue;
    groups.set(date, [...(groups.get(date) ?? []), row]);
  }
  const quizzes: ArchiveQuiz[] = [];
  for (const [date, group] of groups) {
    try {
      const valid = validateQuestionRows(
        group,
        [1, 2, 3, 4, 5],
        source,
        source === 'bigquery',
      );
      const base = {
        id: `archive-${date}`,
        date,
        questions: formatDailyQuizQuestions(valid),
      };
      const generated = group[0]?.generated_at;
      quizzes.push({
        ...base,
        contentVersion: getDailyQuizContentSignature(base),
        source: {
          system: source,
          licensingStatus: 'unknown',
          questions: valid.map(row=>({questionId:row.question_id,playerId:row.player_id})),
          generatedAt:
            typeof generated === 'string' ? generated : generated?.value,
        },
      });
    } catch {
      /* Incomplete/invalid dates are unavailable, never partially playable. */
    }
  }
  return quizzes.sort((a, b) => b.date.localeCompare(a.date));
}
let cache: {
  today: string;
  expires: number;
  value: Promise<ArchiveQuiz[]>;
} | null = null;
export async function getArchiveContent(today: string): Promise<ArchiveQuiz[]> {
  if (cache?.today === today && cache.expires > Date.now()) return cache.value;
  const load = async () => {
    const legacy = await query<DatedRow>(
      `SELECT date::TEXT AS date,question_id,question,player_id,player_name,player_0,player_1,player_2,player_3,rank
      FROM public.pu_player_ques WHERE date<$1::DATE AND language='uk' AND rank BETWEEN 1 AND 5
      AND ($2::DATE IS NULL OR date<$2::DATE)`,
      [today, process.env.BIGQUERY_CUTOVER_DATE || null],
    );
    const result = buildArchiveCatalog(legacy, today, 'cockroach');
    if (process.env.BIGQUERY_CUTOVER_DATE) {
      const { projectId, dataset } = getBigQueryConfig();
      const [rows] = await getBigQueryClient().query({
        query: `SELECT date,question_id,question,player_id,player_name,player_0,player_1,player_2,player_3,rank,correct_answer_position,generated_at
        FROM \`${projectId}.${dataset}.questions\` WHERE date<@today AND date>=@cutover AND LOWER(country)='uk' AND LOWER(language)='english' AND generation_status='ok' AND rank BETWEEN 1 AND 5`,
        params: { today, cutover: process.env.BIGQUERY_CUTOVER_DATE },
        types: { today: 'DATE', cutover: 'DATE' },
        maximumBytesBilled: '100000000',
        location: getBigQueryLocation(),
      });
      result.push(
        ...buildArchiveCatalog(rows as DatedRow[], today, 'bigquery'),
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  };
  const value = load().catch((error) => {
    cache = null;
    throw error;
  });
  cache = { today, expires: Date.now() + 5 * 60 * 1000, value };
  return value;
}
