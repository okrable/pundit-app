import type { Config } from '@netlify/functions';
import { query } from './lib/db';

const RAW_EVENT_RETENTION_DAYS = 90;

export default async function purgeAnalyticsEvents(): Promise<Response> {
  try {
    const deleted = await query<{ id: string }>(
      `DELETE FROM analytics_events
       WHERE occurred_at < now() - INTERVAL '90 days'
       RETURNING id`
    );

    console.info(
      '[analytics.retention.complete]',
      JSON.stringify({ deletedCount: deleted.length, retentionDays: RAW_EVENT_RETENTION_DAYS })
    );
    return Response.json({ deletedCount: deleted.length });
  } catch (error) {
    console.error(
      '[analytics.retention.failed]',
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return Response.json({ error: 'Unable to purge analytics events' }, { status: 500 });
  }
}

export const config: Config = {
  schedule: '@daily',
};
