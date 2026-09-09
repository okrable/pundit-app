import type { CareerGameResult, SyncState } from '../app/types';
export interface CachedCareerGameResult extends CareerGameResult {
  cachedAt: string;
  userId?: string;
  pendingSync?: boolean;
}
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  multiRemove(keys: string[]): Promise<unknown>;
}
export function createJourneyRepository(storage: Storage) {
  const queues = new Map<string, Promise<unknown>>();
  const key = (id?: string) =>
    `@pundit_journey_v2_${!id || id.startsWith('guest_') ? 'guest' : id}`;
  const read = async (id?: string): Promise<CachedCareerGameResult | null> => {
    let raw = await storage.getItem(key(id));
    if (!raw)
      raw = await storage.getItem(
        !id || id.startsWith('guest_')
          ? '@pundit_daily_career_result_guest'
          : `@pundit_daily_career_result_auth_${id}`,
      );
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as CachedCareerGameResult;
      if (
        !v ||
        typeof v.gameId !== 'string' ||
        typeof v.date !== 'string' ||
        typeof v.canonicalName !== 'string' ||
        typeof v.submittedAnswer !== 'string' ||
        (v.outcome !== undefined &&
          v.outcome !== 'solved' &&
          v.outcome !== 'given_up') ||
        (id && !id.startsWith('guest_') && v.userId && v.userId !== id)
      )
        return null;
      return { ...v, outcome: v.outcome ?? 'solved' };
    } catch {
      return null;
    }
  };
  return {
    async read(id?: string) {
      await queues.get(key(id));
      return read(id);
    },
    save(
      result: CareerGameResult,
      id?: string,
      syncState?: SyncState,
    ): Promise<CachedCareerGameResult> {
      const k = key(id);
      const work = (queues.get(k) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          const prior = await read(id);
          const value = {
            ...result,
            outcome: result.outcome ?? ('solved' as const),
            userId: id,
            syncState: syncState ?? result.syncState,
            cachedAt: new Date().toISOString(),
          };
          // A delayed yesterday response cannot erase today's game. Canonical confirmations
          // can replace provisional outcomes, but provisional writes cannot replace canonical ones.
          if (
            prior &&
            (prior.date > value.date ||
              (prior.gameId === value.gameId &&
                prior.syncState === 'synced' &&
                value.syncState !== 'synced'))
          )
            return prior;
          await storage.setItem(k, JSON.stringify(value));
          return value;
        });
      queues.set(
        k,
        work.catch(() => {}),
      );
      return work;
    },
    async clearGuest() {
      await queues.get(key());
      await storage.multiRemove([key(), '@pundit_daily_career_result_guest']);
    },
  };
}
