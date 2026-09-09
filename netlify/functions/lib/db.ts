import { PREVIEW_BUILD } from './deploymentContext';
import { Pool, PoolClient, QueryResultRow } from 'pg';

let pool: Pool | null = null;

export function databaseConnection(env: Record<string, string | undefined> = process.env, previewBuild = PREVIEW_BUILD): string | undefined {
  if (previewBuild || env.CONTEXT === 'deploy-preview' || env.CONTEXT === 'branch-deploy') {
    if (!env.PREVIEW_DATABASE_URL || env.PREVIEW_DATABASE_URL === env.DATABASE_URL) {
      throw new Error('Preview persistence requires a separate PREVIEW_DATABASE_URL');
    }
    if (env.DATABASE_URL) {
      const preview = new URL(env.PREVIEW_DATABASE_URL);
      const production = new URL(env.DATABASE_URL);
      if (preview.host === production.host && preview.pathname === production.pathname) {
        throw new Error('Preview persistence requires a separate database');
      }
    }
    return env.PREVIEW_DATABASE_URL;
  }
  return env.DATABASE_URL;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseConnection(),
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  return queryUsingPool<T>(getPool(), text, params);
}

export async function queryUsingPool<T>(
  source: Pick<Pool, 'connect'>, text: string, params?: any[]
): Promise<T[]> {
  const client = await source.connect();
  try {
    return await queryWithClient<T>(client, text, params);
  } finally {
    client.release();
  }
}

export async function queryWithClient<T = QueryResultRow>(
  client: PoolClient,
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await client.query(text, params);
  return result.rows as T[];
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
