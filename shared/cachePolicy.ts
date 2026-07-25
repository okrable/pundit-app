export function isCacheSchemaCurrent(
  cachedVersion: number,
  expectedVersion: number
): boolean {
  return cachedVersion === expectedVersion;
}
