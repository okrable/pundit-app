import { BigQuery } from '@google-cloud/bigquery';
import type { BigQueryOptions, Query } from '@google-cloud/bigquery';
import { query } from './db';

export type QuestionSource = 'bigquery' | 'cockroach';

export interface SourceQuestionRow {
  question_id: string;
  question: string | null;
  player_id: string | null;
  player_name: string | null;
  player_0: string | null;
  player_1: string | null;
  player_2: string | null;
  player_3: string | null;
  rank: number | null;
  correct_answer_position?: number | null;
}

export interface SourceCareerStatRow {
  years: string | null;
  team: string | null;
  appearances: number | null;
  goals: number | null;
  category: string | null;
  rank: number | null;
}

export interface QuestionSourceClients {
  bigQuery<T>(options: Query): Promise<T[]>;
  cockroach<T>(text: string, values?: any[]): Promise<T[]>;
}

export class QuestionSourceError extends Error {
  constructor(
    message: string,
    public readonly source: QuestionSource,
    public readonly code: string
  ) {
    super(message);
    this.name = 'QuestionSourceError';
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_PROJECT_PATTERN = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const SAFE_DATASET_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BIGQUERY_COUNTRY = 'uk';
const BIGQUERY_LANGUAGE = 'English';

let bigQueryClient: BigQuery | null = null;
const bigQueryQuestionCache = new Map<
  string,
  { expiresAt: number; rows: Promise<SourceQuestionRow[]> }
>();
const BIGQUERY_QUESTION_CACHE_MS = 5 * 60 * 1000;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getQuestionSource(
  date: string,
  language: string,
  cutoverDate = process.env.BIGQUERY_CUTOVER_DATE
): QuestionSource {
  if (!cutoverDate) {
    return 'cockroach';
  }

  if (!isValidIsoDate(cutoverDate)) {
    throw new QuestionSourceError(
      'BIGQUERY_CUTOVER_DATE must use YYYY-MM-DD',
      'bigquery',
      'INVALID_CUTOVER_DATE'
    );
  }

  return language.toLowerCase() === 'uk' && date >= cutoverDate
    ? 'bigquery'
    : 'cockroach';
}

function getBigQueryConfig(): { projectId: string; dataset: string } {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'pundit-498720';
  const dataset = process.env.BIGQUERY_DATASET || 'pundit';

  if (!SAFE_PROJECT_PATTERN.test(projectId)) {
    throw new QuestionSourceError(
      'BIGQUERY_PROJECT_ID is invalid',
      'bigquery',
      'INVALID_PROJECT_ID'
    );
  }

  if (!SAFE_DATASET_PATTERN.test(dataset)) {
    throw new QuestionSourceError(
      'BIGQUERY_DATASET is invalid',
      'bigquery',
      'INVALID_DATASET'
    );
  }

  return { projectId, dataset };
}

function getBigQueryClient(): BigQuery {
  if (bigQueryClient) {
    return bigQueryClient;
  }

  const { projectId } = getBigQueryConfig();
  const options: BigQueryOptions = { projectId };
  const credentialsJson = process.env.BIGQUERY_SERVICE_ACCOUNT_JSON;

  if (credentialsJson) {
    try {
      options.credentials = JSON.parse(credentialsJson);
    } catch {
      throw new QuestionSourceError(
        'BIGQUERY_SERVICE_ACCOUNT_JSON is not valid JSON',
        'bigquery',
        'INVALID_CREDENTIALS_JSON'
      );
    }
  }

  bigQueryClient = new BigQuery(options);
  return bigQueryClient;
}

const defaultClients: QuestionSourceClients = {
  async bigQuery<T>(options: Query): Promise<T[]> {
    const [rows] = await getBigQueryClient().query(options);
    return rows as T[];
  },
  cockroach<T>(text: string, values?: any[]): Promise<T[]> {
    return query<T>(text, values);
  },
};

function getBigQueryLocation(): string | undefined {
  return process.env.BIGQUERY_LOCATION?.trim() || undefined;
}

function logSourceRead(
  operation: string,
  source: QuestionSource,
  date: string,
  startedAt: number,
  rowCount: number,
  errorCode?: string
) {
  console.log('Question source read', {
    operation,
    source,
    date,
    durationMs: Date.now() - startedAt,
    rowCount,
    ...(errorCode ? { errorCode } : {}),
  });
}

function asQuestionSourceError(
  error: unknown,
  source: QuestionSource
): QuestionSourceError {
  if (error instanceof QuestionSourceError) {
    return error;
  }

  const wrapped = new QuestionSourceError(
    source === 'bigquery'
      ? 'BigQuery question source is temporarily unavailable'
      : 'Cockroach question source is temporarily unavailable',
    source,
    'READ_FAILED'
  );
  wrapped.cause = error;
  return wrapped;
}

function getOptions(row: SourceQuestionRow): string[] {
  return [row.player_0, row.player_1, row.player_2, row.player_3]
    .map((option) => option?.trim() || '')
    .filter(Boolean);
}

export function validateQuestionRows(
  rows: SourceQuestionRow[],
  expectedRanks: number[],
  source: QuestionSource,
  requireDeclaredCorrectPosition: boolean
): SourceQuestionRow[] {
  const byRank = new Map<number, SourceQuestionRow>();
  const questionIds = new Set<string>();

  for (const row of rows) {
    const rank = Number(row.rank);
    if (!expectedRanks.includes(rank) || byRank.has(rank)) {
      throw new QuestionSourceError(
        `Question ranks must be unique and exactly ${expectedRanks.join(', ')}`,
        source,
        'INVALID_RANKS'
      );
    }

    const questionId = row.question_id?.trim();
    const question = row.question?.trim();
    const playerName = row.player_name?.trim();
    const playerId = row.player_id?.trim();
    const options = getOptions(row);

    if (!questionId || !question || !playerName || !playerId) {
      throw new QuestionSourceError(
        `Rank ${rank} is missing required question/player fields`,
        source,
        'MISSING_QUESTION_FIELDS'
      );
    }

    if (questionIds.has(questionId)) {
      throw new QuestionSourceError(
        `Duplicate question_id ${questionId}`,
        source,
        'DUPLICATE_QUESTION_ID'
      );
    }
    questionIds.add(questionId);

    if (options.length !== 4 || new Set(options).size !== 4) {
      throw new QuestionSourceError(
        `Rank ${rank} must contain four distinct answer options`,
        source,
        'INVALID_OPTIONS'
      );
    }

    const correctIndex = options.findIndex((option) => option === playerName);
    if (correctIndex < 0) {
      throw new QuestionSourceError(
        `Rank ${rank} does not contain player_name in its options`,
        source,
        'CORRECT_ANSWER_MISSING'
      );
    }

    if (
      requireDeclaredCorrectPosition &&
      Number(row.correct_answer_position) !== correctIndex
    ) {
      throw new QuestionSourceError(
        `Rank ${rank} correct_answer_position does not match player_name`,
        source,
        'CORRECT_POSITION_MISMATCH'
      );
    }

    byRank.set(rank, row);
  }

  if (byRank.size !== expectedRanks.length) {
    throw new QuestionSourceError(
      `Expected ranks ${expectedRanks.join(', ')}, received ${[...byRank.keys()].join(', ') || 'none'}`,
      source,
      'INCOMPLETE_QUESTION_SET'
    );
  }

  return expectedRanks.map((rank) => byRank.get(rank)!);
}

async function getBigQueryQuestionRows(
  date: string,
  ranks: number[],
  clients: QuestionSourceClients
): Promise<SourceQuestionRow[]> {
  const useCache = clients === defaultClients;
  const cached = useCache ? bigQueryQuestionCache.get(date) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    const rows = await cached.rows;
    return rows.filter((row) => ranks.includes(Number(row.rank)));
  }

  const { projectId, dataset } = getBigQueryConfig();
  const rowsPromise = clients.bigQuery<SourceQuestionRow>({
    query: `SELECT
      question_id,
      question,
      player_id,
      player_name,
      player_0,
      player_1,
      player_2,
      player_3,
      rank,
      correct_answer_position
    FROM \`${projectId}.${dataset}.questions\`
    WHERE date = @date
      AND LOWER(country) = LOWER(@country)
      AND LOWER(language) = LOWER(@sourceLanguage)
      AND generation_status = 'ok'
      AND rank BETWEEN 1 AND 6
    ORDER BY rank`,
    params: {
      date: BigQuery.date(date),
      country: BIGQUERY_COUNTRY,
      sourceLanguage: BIGQUERY_LANGUAGE,
    },
    types: {
      date: 'DATE',
      country: 'STRING',
      sourceLanguage: 'STRING',
    },
    ...(getBigQueryLocation() ? { location: getBigQueryLocation() } : {}),
  });
  if (useCache) {
    bigQueryQuestionCache.set(date, {
      expiresAt: Date.now() + BIGQUERY_QUESTION_CACHE_MS,
      rows: rowsPromise,
    });
  }

  try {
    const rows = await rowsPromise;
    return rows.filter((row) => ranks.includes(Number(row.rank)));
  } catch (error) {
    if (useCache) {
      bigQueryQuestionCache.delete(date);
    }
    throw error;
  }
}

async function getCockroachQuestionRows(
  date: string,
  language: string,
  clients: QuestionSourceClients
): Promise<SourceQuestionRow[]> {
  return clients.cockroach<SourceQuestionRow>(
    `SELECT
       question_id,
       question,
       player_id,
       player_name,
       player_0,
       player_1,
       player_2,
       player_3,
       rank
     FROM public.pu_player_ques
     WHERE date = $1 AND language = $2
     ORDER BY rank ASC
     LIMIT 5`,
    [date, language]
  );
}

export async function getDailyQuestionRows(
  date: string,
  language = 'uk',
  clients: QuestionSourceClients = defaultClients
): Promise<SourceQuestionRow[]> {
  const source = getQuestionSource(date, language);
  const startedAt = Date.now();

  try {
    const rows = source === 'bigquery'
      ? await getBigQueryQuestionRows(date, [1, 2, 3, 4, 5, 6], clients)
      : await getCockroachQuestionRows(date, language, clients);
    const validated = source === 'bigquery'
      ? validateQuestionRows(rows, [1, 2, 3, 4, 5, 6], source, true).slice(0, 5)
      : rows;
    logSourceRead('daily_questions', source, date, startedAt, validated.length);
    return validated;
  } catch (error) {
    const sourceError = asQuestionSourceError(error, source);
    const code = sourceError.code;
    logSourceRead('daily_questions', source, date, startedAt, 0, code);
    throw sourceError;
  }
}

export async function getAnswerKeyRows(
  date: string,
  language: string,
  questionIds: string[],
  clients: QuestionSourceClients = defaultClients
): Promise<SourceQuestionRow[]> {
  const source = getQuestionSource(date, language);
  const startedAt = Date.now();
  const uniqueIds = [...new Set(questionIds)];

  try {
    let rows: SourceQuestionRow[];
    if (source === 'bigquery') {
      const bundle = validateQuestionRows(
        await getBigQueryQuestionRows(date, [1, 2, 3, 4, 5, 6], clients),
        [1, 2, 3, 4, 5, 6],
        source,
        true
      );
      const requestedIds = new Set(uniqueIds);
      rows = bundle
        .slice(0, 5)
        .filter((row) => requestedIds.has(row.question_id));
      if (rows.length !== uniqueIds.length) {
        throw new QuestionSourceError(
          'Submitted question IDs do not match the BigQuery quiz bundle',
          source,
          'ANSWER_KEY_MISMATCH'
        );
      }
    } else {
      rows = await clients.cockroach<SourceQuestionRow>(
        `SELECT
           question_id,
           question,
           player_id,
           player_name,
           player_0,
           player_1,
           player_2,
           player_3,
           rank
         FROM public.pu_player_ques
         WHERE question_id = ANY($1)`,
        [uniqueIds]
      );
    }

    logSourceRead('answer_keys', source, date, startedAt, rows.length);
    return rows;
  } catch (error) {
    const sourceError = asQuestionSourceError(error, source);
    const code = sourceError.code;
    logSourceRead('answer_keys', source, date, startedAt, 0, code);
    throw sourceError;
  }
}

export async function getCareerSourceRows(
  date: string,
  language = 'uk',
  clients: QuestionSourceClients = defaultClients
): Promise<{ question: SourceQuestionRow; career: SourceCareerStatRow[] } | null> {
  if (getQuestionSource(date, language) !== 'bigquery') {
    return null;
  }

  const startedAt = Date.now();
  try {
    const questions = await getBigQueryQuestionRows(date, [6], clients);
    if (questions.length === 0) {
      logSourceRead('career_game', 'bigquery', date, startedAt, 0, 'CAREER_MISSING');
      return null;
    }
    const [question] = validateQuestionRows(questions, [6], 'bigquery', true);
    const { projectId, dataset } = getBigQueryConfig();
    const rows = await clients.bigQuery<SourceCareerStatRow>({
      query: `SELECT
        Years AS years,
        Team AS team,
        Apps AS appearances,
        Gls AS goals,
        DomNat AS category,
        Rank AS rank
      FROM \`${projectId}.${dataset}.player_stats\`
      WHERE player_id = @playerId
      ORDER BY
        CASE DomNat
          WHEN 'Domestic' THEN 1
          WHEN 'International' THEN 2
          ELSE 3
        END,
        Rank`,
      params: { playerId: question.player_id },
      types: { playerId: 'STRING' },
      ...(getBigQueryLocation() ? { location: getBigQueryLocation() } : {}),
    });
    const career = validateCareerRows(rows);
    logSourceRead('career_game', 'bigquery', date, startedAt, career.length);
    return { question, career };
  } catch (error) {
    const sourceError = asQuestionSourceError(error, 'bigquery');
    const code = sourceError.code;
    logSourceRead('career_game', 'bigquery', date, startedAt, 0, code);
    throw sourceError;
  }
}

export function validateCareerRows(rows: SourceCareerStatRow[]): SourceCareerStatRow[] {
  const seen = new Set<string>();
  const validated = rows.map((row) => {
    const category = row.category?.trim();
    const years = row.years?.trim();
    const team = row.team?.trim();
    const rank = Number(row.rank);
    const appearances = Number(row.appearances);
    const goals = Number(row.goals);
    const key = `${category}:${rank}`;

    if (
      !category ||
      !years ||
      !team ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      !Number.isInteger(appearances) ||
      appearances < 0 ||
      !Number.isInteger(goals) ||
      goals < 0 ||
      seen.has(key)
    ) {
      throw new QuestionSourceError(
        'Career rows must have unique category/rank values and valid stats',
        'bigquery',
        'INVALID_CAREER_ROWS'
      );
    }
    seen.add(key);
    return row;
  });

  if (validated.length === 0) {
    throw new QuestionSourceError(
      'The rank-6 player has no career rows',
      'bigquery',
      'CAREER_ROWS_MISSING'
    );
  }

  return validated;
}
