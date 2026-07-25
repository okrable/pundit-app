const USERNAME_MAX_LENGTH = 20;
const GENERATED_SUFFIX_LENGTH = 8;
const GENERATED_BASE_MAX_LENGTH =
  USERNAME_MAX_LENGTH - GENERATED_SUFFIX_LENGTH - 1;

export function normalizeGeneratedUsernameBase(
  email: string | null | undefined
): string {
  const emailPrefix = email?.split('@')[0] || '';
  const normalized = emailPrefix
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized.length >= 3 ? normalized : 'player';
}

export function buildGeneratedUsername(
  email: string | null | undefined,
  deterministicSuffix: string
): string {
  const suffix = deterministicSuffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, GENERATED_SUFFIX_LENGTH)
    .padEnd(GENERATED_SUFFIX_LENGTH, '0');
  const base = normalizeGeneratedUsernameBase(email).slice(
    0,
    GENERATED_BASE_MAX_LENGTH
  );

  return `${base}_${suffix}`;
}

export async function chooseAvailableGeneratedUsername(
  email: string | null | undefined,
  deterministicSuffixes: string[],
  isUnavailable: (username: string) => Promise<boolean>
): Promise<string> {
  for (const suffix of deterministicSuffixes) {
    const candidate = buildGeneratedUsername(email, suffix);
    if (!(await isUnavailable(candidate))) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique username');
}
