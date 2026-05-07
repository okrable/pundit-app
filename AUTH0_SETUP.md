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

Create an Auth0 `Native` application.

Recommended settings:

| Setting | Value |
|---------|-------|
| Application Type | Native |
| Token Endpoint Authentication Method | None |
| Grant Types | Authorization Code, Refresh Token |
| Refresh Token Rotation | Enabled |

Allowed callback URLs:

```text
pundit-app://*
exp://YOUR-LAN-IP:8081/--/*
```

Allowed logout URLs can include the same values for future compatibility, but the app currently performs local logout only.

Allowed web origins:

```text
exp://YOUR-LAN-IP:8081
```

Use the exact LAN IP and port shown by Expo when testing on a physical device.

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
7. Quiz identity reconciliation runs.
8. Daily-loop profile/leaderboard data is prefetched.
9. The UI leaves `AuthSyncScreen`.

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

Netlify Functions verify Auth0 access tokens for authenticated endpoints and enforce `token.sub === userId`.

Required server variable:

- `AUTH0_DOMAIN`

Shared helper:

- `netlify/functions/lib/auth.ts`

## Troubleshooting

### Login Button Not Appearing

Confirm these are set and restart Expo:

- `EXPO_PUBLIC_AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_CLIENT_ID`

### Redirect Not Working

Confirm Auth0 callback URLs include:

- `pundit-app://*`
- `exp://YOUR-LAN-IP:8081/--/*`

For phone testing, do not use `localhost`; use Expo's LAN URL.

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

Fix Auth0 settings, sign out locally, force-close Expo Go, and log in again. Reinstall Expo Go only if stale local storage cannot be cleared.

## Production Notes

- Set `EXPO_PUBLIC_AUTH0_DOMAIN` and `EXPO_PUBLIC_AUTH0_CLIENT_ID` in the app build environment.
- Set `AUTH0_DOMAIN` in Netlify.
- Add production redirect URLs to Auth0.
- Preserve the centralized auth coordinator model if migrating from Expo AuthSession to a native Auth0 SDK later.
