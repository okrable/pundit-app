import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const AUTH_VERIFICATION_CACHE_TTL_MS = 60_000;

interface StoredAuthVerification {
  subjectDigest: string;
  expiresAt: number;
}

export interface AuthVerificationCache {
  has(accessToken: string, expectedUserId: string): Promise<boolean>;
  remember(accessToken: string, verifiedUserId: string): Promise<void>;
}

interface AuthVerificationStore {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: StoredAuthVerification): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface CreateAuthVerificationCacheOptions {
  now?: () => number;
  getVerificationStore?: () => AuthVerificationStore;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function cacheKey(accessToken: string): string {
  return `v1/${digest(accessToken)}`;
}

function digestsMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function isStoredAuthVerification(value: unknown): value is StoredAuthVerification {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredAuthVerification>;
  return (
    typeof candidate.subjectDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.subjectDigest) &&
    typeof candidate.expiresAt === 'number' &&
    Number.isFinite(candidate.expiresAt)
  );
}

export function createBlobAuthVerificationCache({
  now = Date.now,
  getVerificationStore = () =>
    getStore({
      name: 'auth-verification-v1',
      consistency: 'strong',
    }),
}: CreateAuthVerificationCacheOptions = {}): AuthVerificationCache {
  return {
    has: async (accessToken, expectedUserId) => {
      const key = cacheKey(accessToken);
      try {
        const stored = await getVerificationStore().get(key, { type: 'json' });
        if (!isStoredAuthVerification(stored)) return false;
        if (stored.expiresAt <= now()) {
          await getVerificationStore().delete(key);
          return false;
        }
        return digestsMatch(stored.subjectDigest, digest(expectedUserId));
      } catch (error) {
        console.warn('Auth verification cache read failed; falling back to Auth0', {
          message: error instanceof Error ? error.message : 'Unknown cache error',
        });
        return false;
      }
    },

    remember: async (accessToken, verifiedUserId) => {
      try {
        await getVerificationStore().setJSON(cacheKey(accessToken), {
          subjectDigest: digest(verifiedUserId),
          expiresAt: now() + AUTH_VERIFICATION_CACHE_TTL_MS,
        } satisfies StoredAuthVerification);
      } catch (error) {
        console.warn('Auth verification cache write failed', {
          message: error instanceof Error ? error.message : 'Unknown cache error',
        });
      }
    },
  };
}

export const authVerificationCache = createBlobAuthVerificationCache();
