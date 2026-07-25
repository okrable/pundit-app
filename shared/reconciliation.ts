export type ReconciliationSource = 'local' | 'server' | 'guest' | 'none';

export function chooseReconciliationSource({
  hasLocalResult,
  hasServerResult,
  hasGuestResult,
}: {
  hasLocalResult: boolean;
  hasServerResult: boolean;
  hasGuestResult: boolean;
}): ReconciliationSource {
  if (hasLocalResult) return 'local';
  if (hasServerResult) return 'server';
  if (hasGuestResult) return 'guest';
  return 'none';
}
