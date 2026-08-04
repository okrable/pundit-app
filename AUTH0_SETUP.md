# Auth0 Setup Guide

## Overview

Pundit Trivia supports optional Auth0 authentication. The app remains playable in guest mode when Auth0 is not configured.

The current mobile auth implementation uses Expo AuthSession with Authorization Code + PKCE. Screens do not exchange authorization codes directly; they call the centralized auth coordinator in `app/services/authFlow.ts`.

## Current Behavior

- Login prompts Auth0 through Expo AuthSession.
- The auth coordinator exchanges the returned code exactly once using the matching redirect URI and PKCE verifier.
- The app requests `offline_access` and stores refresh tokens with Expo SecureStore.
- API requests include the Auth0 access token for authenticated users.
- After login, the app reconciles guest/auth daily quiz state and prefetches first profile/leaderboard data behind `AuthSyncScreen`.
- Logout clears local credentials without opening hosted Auth0 logout, avoiding the iOS browser sign-in popup.
- The API client has a defensive one-time 401 retry through refresh-token handling.
- Web and native builds use separate first-party Auth0 clients in the same
  tenant, so the verified Auth0 `sub` remains the same account identity.
- Protected identity guards synchronize the verified Auth0 account into
  `users`, generate a deterministic username for eligible legacy accounts, and
  return `USERNAME_REQUIRED` for incomplete signup identities.

## Packages Used

- `expo-auth-session`
- `expo-crypto`
- `expo-web-browser`
- `expo-secure-store`

## Key Files

- `app/services/authFlow.ts` - login/logout coordinator and post-login sync.
- `app/services/auth0.ts` - Auth0 config, request setup, token refresh helpers.
- `app/state/useAuthStore.ts` - auth session state, restore, refresh, profile mutations.
- `app/storage/authStorage.ts` - secure refresh-token persistence.
- `app/hooks/useAuthInit.ts` - startup auth bootstrap.
- `app/components/AuthSyncScreen.tsx` - login/reconciliation interstitial.
- `app/services/api.ts` - bearer-token injection and defensive 401 retry.

## Auth0 Application Setup

Use two first-party Auth0 applications in the same tenant:

| Surface | Auth0 application type | Client environment |
|---------|------------------------|--------------------|
| Responsive web | Single Page Application | Netlify |
| iOS and Android | Native | EAS |

Both clients use Authorization Code + PKCE, enable the Refresh Token grant, and
use refresh-token rotation. The native client's Token Endpoint Authentication
Method must be `None`.

Configure the web client's allowed callback URLs:

```text
https://pundittrivia.com/
https://deploy-preview-*--effervescent-tiramisu-8a2849.netlify.app/
```

Configure the native client's allowed callback and logout URL:

```text
pundit-app://callback
```

The app currently performs local logout only, but retaining the native logout
URL keeps the client ready for a future hosted logout flow.

Configure the web client's allowed web origins:

```text
https://pundittrivia.com
https://deploy-preview-*--effervescent-tiramisu-8a2849.netlify.app
```

The constrained Netlify wildcard is for non-production Deploy Previews only.
Production uses the exact custom-domain URL.

For Expo Go convenience testing, also add the exact `exp://` callback and origin
printed by the local Expo server. Do not use `localhost` for a physical device.
Expo Go uses the JavaScript tab fallback; use an EAS development-client build
for native-tab and release-path authentication acceptance.

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Client-side:

```env
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

Netlify must receive the Single Page Application client ID. EAS preview and
production environments must receive the Native client ID under the same
`EXPO_PUBLIC_AUTH0_CLIENT_ID` variable name. Both use the same tenant domain, so
an account keeps the same Auth0 subject across web and mobile.

Server-side:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
```

The current Netlify auth check does not require `AUTH0_CLIENT_SECRET` or `AUTH0_AUDIENCE`.

Restart Expo after changing environment variables:

```bash
npm start
```

## Login Flow

1. User taps a sign-in CTA.
2. Screen calls `loginWithAuth0`.
3. Expo opens Auth0 Universal Login.
4. Auth0 redirects back with an authorization code.
5. `authFlow` exchanges the code once using PKCE.
6. User info and credentials are stored in `useAuthStore`.
7. `/syncIdentity` returns the canonical username and onboarding state.
8. Incomplete identities remain on username onboarding until selection or sign-out.
9. Completed identities run quiz reconciliation and daily-loop prefetch.
10. The UI leaves `AuthSyncScreen` for normal navigation.

The server-side identity foundation and v2.0.0 client activation are active.
Signup, login, and restoration synchronize identity before normal navigation.
An incomplete identity receives a blocking username screen with sign-out as its
only escape.

## Session Restoration

On launch, the app attempts refresh-token restoration from SecureStore. If refresh or userinfo fails, the stored auth session is cleared and the app falls back to guest mode.

Profile refreshes and API responses are guarded against stale auth-state changes so old login/logout requests do not overwrite newer state.

## Guest Result Reconciliation

Guest daily plays do not submit to the server immediately. After login:

- existing authenticated local/server result wins;
- otherwise a valid guest result is migrated/adopted;
- guest cache is cleared after successful reconciliation;
- stale in-progress quiz UI is reset behind `AuthSyncScreen`.

## Backend Verification

Netlify Functions verify Auth0 access tokens for authenticated endpoints and
enforce `token.sub === userId`. Protected social endpoints additionally call
the shared completed-identity guard in
`netlify/functions/lib/identity.ts`.

Required server variable:

- `AUTH0_DOMAIN`

Shared helper:

- `netlify/functions/lib/auth.ts`
- `netlify/functions/lib/identity.ts`
- `netlify/functions/syncIdentity.ts`

## Troubleshooting

### Login Button Not Appearing

Confirm these are set and restart Expo:

- `EXPO_PUBLIC_AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_CLIENT_ID`

### Redirect Not Working

Confirm Auth0 callback URLs include:

- Web client: `https://pundittrivia.com/`
- Web client: `https://deploy-preview-*--effervescent-tiramisu-8a2849.netlify.app/`
- Native client: `pundit-app://callback`

For Expo Go convenience testing, add the exact LAN callback printed by Expo.
For phone testing, do not use `localhost`; use Expo's LAN URL. Validate the
native iOS callback in a development-client or preview build before release.

### Invalid Authorization Code

This usually means an old AuthSession response or duplicated code exchange was processed. The current implementation avoids this by centralizing login in `authFlow` and removing screen-level response handlers.

If it reappears, check for any new code that calls `exchangeCodeAsync` outside `app/services/authFlow.ts`.

### Token Refresh Failed

Common causes:

- Auth0 application is not Native.
- Token Endpoint Authentication Method is not `None`.
- Refresh Token grant is disabled.
- Refresh token rotation is disabled or misconfigured.
- A stale local refresh token predates Auth0 setting changes.

Fix Auth0 settings, sign out locally, force-close the current app runtime, and
log in again. Reinstall the development client or Expo Go only if stale local
storage cannot be cleared.

## Production Notes

- Set `EXPO_PUBLIC_AUTH0_DOMAIN` and `EXPO_PUBLIC_AUTH0_CLIENT_ID` in the app build environment.
- Set `AUTH0_DOMAIN` in Netlify.
- Add production redirect URLs to Auth0.
- Preserve the centralized auth coordinator model if migrating from Expo AuthSession to a native Auth0 SDK later.
