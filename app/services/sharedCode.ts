export type SharedCodeKind = 'challenge' | 'friendInvite' | 'invalid';

export interface SharedCodeAction {
  kind: SharedCodeKind;
  code: string;
}

export function normalizeSharedCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function resolveSharedCode(value: string): SharedCodeAction {
  const code = normalizeSharedCode(value);

  if (code.length === 6) {
    return { kind: 'challenge', code };
  }

  if (code.length === 8) {
    return { kind: 'friendInvite', code };
  }

  return { kind: 'invalid', code };
}

export function getSharedCodeActionFromUrl(url: string): SharedCodeAction | null {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const firstPart = pathParts[0];
    const pathCode = pathParts[1];
    const queryCode =
      parsedUrl.searchParams.get('code') ||
      parsedUrl.searchParams.get('challenge') ||
      parsedUrl.searchParams.get('invite');

    if ((firstPart === 'f' || firstPart === 'add-friend') && (pathCode || queryCode)) {
      const action = resolveSharedCode(pathCode || queryCode || '');
      return action.kind === 'friendInvite' ? action : null;
    }

    if ((firstPart === 'c' || firstPart === 'challenge') && (pathCode || queryCode)) {
      const action = resolveSharedCode(pathCode || queryCode || '');
      return action.kind === 'challenge' ? action : null;
    }

    if (queryCode) {
      const action = resolveSharedCode(queryCode);
      return action.kind === 'invalid' ? null : action;
    }

    if (parsedUrl.protocol === 'pundit-app:' && parsedUrl.hostname === 'add-friend') {
      const action = resolveSharedCode(pathParts[0] || queryCode || '');
      return action.kind === 'friendInvite' ? action : null;
    }

    if (parsedUrl.protocol === 'pundit-app:' && parsedUrl.hostname === 'challenge') {
      const action = resolveSharedCode(pathParts[0] || queryCode || '');
      return action.kind === 'challenge' ? action : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildShareUrl(path: 'c' | 'f', code: string, fallbackOrigin: string): string {
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/${path}/${normalizeSharedCode(code)}`;
}
