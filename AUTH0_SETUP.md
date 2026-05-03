# Auth0 Setup Guide

## Overview

Pundit Trivia supports Auth0 authentication using Expo-compatible packages. The app falls back to guest mode when Auth0 is not configured.

## Current State

Auth0 integration is implemented and currently does the following:
- Uses `expo-auth-session` for OAuth
- Uses Authorization Code + PKCE for login
- Requests `offline_access` so the app can restore a session on next launch
- Stores the refresh token locally with `expo-secure-store`
- Adds the Auth0 access token to API requests when authenticated

## Implementation Details

### Packages Used
- `expo-auth-session` for OAuth flow
- `expo-crypto` for PKCE support
- `expo-web-browser` for browser-based authentication
- `expo-secure-store` for refresh-token storage on device

### Key Files
- [app/services/auth0.ts](app/services/auth0.ts) for Auth0 config, login request setup, and refresh-token exchange
- [app/state/useAuthStore.ts](app/state/useAuthStore.ts) for session restore on app startup
- [app/storage/authStorage.ts](app/storage/authStorage.ts) for refresh-token persistence
- [app/hooks/useAuthInit.ts](app/hooks/useAuthInit.ts) for auth bootstrap
- [app/screens/MeScreen.tsx](app/screens/MeScreen.tsx) for login/logout UI
- [app/services/api.ts](app/services/api.ts) for bearer-token injection on API calls

## Setup Instructions

### 1. Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new `Native` application
3. Note your:
   - Domain, for example `your-tenant.auth0.com`
   - Client ID

### 2. Configure Auth0 Application

In your Auth0 application settings:

**Application Type**
```text
Native
```

**Token Endpoint Authentication Method**
```text
None
```

**Allowed Callback URLs**
```text
pundit-app://*
exp://YOUR-LAN-IP:8081/--/*
```

Example:
```text
exp://192.168.1.42:8081/--/*
```

**Allowed Logout URLs**
```text
pundit-app://*
exp://YOUR-LAN-IP:8081/--/*
```

**Allowed Web Origins**
```text
exp://YOUR-LAN-IP:8081
```

Replace `YOUR-LAN-IP` with the exact host shown by Expo when you run `npm start`. If Expo changes ports or IPs, update Auth0 to match.

### 3. Enable Refresh Tokens

This app requests `offline_access` and restores the session on launch using a refresh token. If Auth0 does not issue or accept refresh tokens for your app, you will see `Token refresh failed` when the app starts.

#### Step 3a: Refresh Token Rotation

1. Go to `Applications > Applications`
2. Select your Native application
3. Open `Settings`
4. Find the refresh-token settings
5. Enable rotation
6. Set a reasonable reuse interval, for example `60` seconds
7. Set refresh-token expiration:
   - Absolute lifetime: for example `2592000` seconds, 30 days
   - Inactivity lifetime: for example `1296000` seconds, 15 days

#### Step 3b: Grant Types

1. In the same application, open `Advanced Settings`
2. Go to `Grant Types`
3. Ensure these are enabled:
   - `Authorization Code`
   - `Refresh Token`

#### Summary

| Setting | Location | Value |
|---------|----------|-------|
| Application Type | Applications > Your App > Settings | Native |
| Token Endpoint Authentication Method | Applications > Your App > Settings | None |
| Refresh Token Rotation | Applications > Your App > Settings | Enabled |
| Reuse Interval | Applications > Your App > Settings | 60 seconds |
| Absolute Lifetime | Applications > Your App > Settings | 2592000 |
| Inactivity Lifetime | Applications > Your App > Settings | 1296000 |
| Grant Types | Applications > Your App > Advanced Settings | Authorization Code, Refresh Token |

### 4. Set Up Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Add your Auth0 credentials:

```env
# Client-side
# Must use EXPO_PUBLIC_ prefix
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your-client-id

# Server-side
# Required by the current Netlify auth check:
AUTH0_DOMAIN=your-tenant.auth0.com

# Not currently used by this repo's Netlify functions:
# AUTH0_CLIENT_SECRET=your-client-secret
# AUTH0_AUDIENCE=your-api-identifier
```

### 5. Restart Development Server

After updating `.env`:

```bash
npm start
```

Then fully reload Expo Go.

## Expo Go Notes

When testing on your phone over local network:
- Use the exact `exp://...` host shown by Expo
- Do not use `exp://localhost:8081/...` for phone testing
- Keep `pundit-app://*` in Auth0 as well, because the app also uses the custom scheme
- If your laptop IP changes, update Auth0 callback and logout URLs

## How It Works

### Guest Mode
- No Auth0 configuration required
- App works with a local guest user
- Results can be stored locally

### Authenticated Mode
1. User taps the Auth0 login button
2. Expo opens Auth0 Universal Login in the browser
3. User signs in
4. App receives an authorization code
5. App exchanges the code for an access token and refresh token using PKCE
6. App fetches `/userinfo`
7. App stores the refresh token locally
8. API requests include `Authorization: Bearer <access-token>`

### Session Restoration

When the app launches:
1. It reads the stored refresh token
2. It posts the refresh token to Auth0 `/oauth/token`
3. It fetches fresh `/userinfo`
4. The user is restored silently

If refresh fails, the app clears the stored auth session and falls back to anonymous mode.

## Backend Verification

Netlify Functions verify Auth0 access tokens for authenticated endpoints and enforce `token.sub === userId`.

Required server environment variable:
- `AUTH0_DOMAIN`, for example `your-tenant.auth0.com`

Current implementation note:
- This repo does not currently use `AUTH0_CLIENT_SECRET` or `AUTH0_AUDIENCE`
- Verification is done by calling Auth0 `/userinfo` with the bearer token and comparing the returned `sub`

Implementation detail:
- Shared helper: [netlify/functions/lib/auth.ts](netlify/functions/lib/auth.ts)

## Troubleshooting

### Login Button Not Appearing
Check that both are set:
- `EXPO_PUBLIC_AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_CLIENT_ID`

Then restart Expo.

### Redirect Not Working
Verify that Auth0 includes:
- `pundit-app://*`
- `exp://YOUR-LAN-IP:8081/--/*`

If you are using Expo Go on your phone, `localhost` is wrong. Use the LAN IP shown by Expo.

### Authentication Completes But User Is Not Logged In
Check the console for token-exchange errors. Common causes:
- Wrong Auth0 domain
- Wrong client ID
- Incorrect callback URL
- App is not configured as a Native app

### User Does Not Stay Logged In
Check the Auth0 application settings:
- `Refresh Token` grant type must be enabled
- Refresh token rotation should be enabled
- Token endpoint auth method should be `None`
- Login must return a `refresh_token`

### "Token refresh failed" On App Launch
This means the app found a stored refresh token and Auth0 rejected the refresh request.

Common causes:
- App is not a `Native` Auth0 application
- `Token Endpoint Authentication Method` is not `None`
- `Refresh Token` grant type is disabled
- Refresh token rotation is disabled or misconfigured
- You changed Auth0 settings after a previous login, but the app is still holding the old refresh token

What to do:
1. Fix the Auth0 settings above
2. Clear the old local session in Expo Go
3. Log in again

### How to Clear the Stored Session in Expo Go
Try these in order:

1. In the app, open Settings and tap `Sign Out`
2. Force-close Expo Go and reopen it
3. If the app still restores the broken session, uninstall Expo Go from your phone and reinstall it

Reinstalling Expo Go is the most reliable way to clear the stored refresh token on device.

## Production Deployment

When deploying to production:

1. Set `EXPO_PUBLIC_AUTH0_DOMAIN` and `EXPO_PUBLIC_AUTH0_CLIENT_ID` in your app build environment
2. Keep `AUTH0_DOMAIN` set in Netlify for backend verification
3. Add your production redirect URLs to Auth0

Example app build env:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_AUTH0_DOMAIN": "your-tenant.auth0.com",
        "EXPO_PUBLIC_AUTH0_CLIENT_ID": "your-client-id"
      }
    }
  }
}
```

Production redirect URL:
```text
pundit-app://*
```
