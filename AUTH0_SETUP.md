# Auth0 Setup Guide

## Overview

Pundit Trivia now supports Auth0 authentication using Expo-compatible packages. The app gracefully falls back to guest mode when Auth0 is not configured.

## Current State

Auth0 integration is **fully implemented** and ready to use:
- Uses `expo-auth-session` for OAuth flow (Expo-compatible, no native modules)
- Automatic token injection for API calls
- Graceful fallback to guest mode when Auth0 is not configured
- Settings screen with login/logout functionality
- **Offline access tokens** for persistent login sessions (users stay logged in)

## Implementation Details

### Packages Used
- `expo-auth-session` - OAuth authentication flow
- `expo-crypto` - Cryptographic operations for PKCE
- `expo-web-browser` - Browser-based authentication
- `expo-secure-store` - Secure storage for refresh tokens (iOS Keychain / Android Keystore)

### Key Files
- [app/services/auth0.ts](app/services/auth0.ts) - Auth0 configuration, hooks, and token refresh
- [app/state/useAuthStore.ts](app/state/useAuthStore.ts) - Authentication state management with session restoration
- [app/storage/authStorage.ts](app/storage/authStorage.ts) - Secure token storage (SecureStore/AsyncStorage)
- [app/hooks/useAuthInit.ts](app/hooks/useAuthInit.ts) - Auth initialization hook for app startup
- [app/screens/MeScreen.tsx](app/screens/MeScreen.tsx) - Login/logout UI
- [app/services/api.ts](app/services/api.ts) - Automatic token injection for API calls

## Setup Instructions

### 1. Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new **Native** application
3. Note your:
   - Domain (e.g., `your-tenant.auth0.com`)
   - Client ID

### 2. Configure Auth0 Application

In your Auth0 application settings:

**Allowed Callback URLs:**
```
pundit-app://*, exp://localhost:8081/--/*
```

**Allowed Logout URLs:**
```
pundit-app://*, exp://localhost:8081/--/*
```

**Allowed Web Origins:**
```
pundit-app://*, exp://localhost:8081
```

### 3. Enable Refresh Tokens (Offline Access)

**IMPORTANT:** To keep users logged in between app sessions, you must enable refresh tokens in Auth0.

#### Step 3a: Enable Refresh Token Rotation (Recommended)

1. Go to your Auth0 Dashboard
2. Navigate to **Applications > APIs**
3. Select your API (or the default "Auth0 Management API" if using first-party apps)
4. Go to the **Settings** tab
5. Under **Access Settings**, ensure **Allow Offline Access** is enabled

#### Step 3b: Configure Your Application for Refresh Tokens

1. Go to **Applications > Applications**
2. Select your Native application
3. Go to the **Settings** tab
4. Scroll down to **Refresh Token Rotation**
5. Enable **Rotation** (recommended for security)
6. Set **Reuse Interval** to something reasonable (e.g., 60 seconds)
7. Under **Refresh Token Expiration**:
   - Set **Absolute Lifetime** (e.g., 2592000 seconds = 30 days)
   - Set **Inactivity Lifetime** (e.g., 1296000 seconds = 15 days)

#### Step 3c: Grant Types

1. Still in your application settings
2. Scroll to **Advanced Settings > Grant Types**
3. Ensure these are enabled:
   - **Authorization Code**
   - **Refresh Token**

#### Summary of Auth0 Dashboard Settings for Offline Access

| Setting | Location | Value |
|---------|----------|-------|
| Allow Offline Access | APIs > Your API > Settings | Enabled |
| Refresh Token Rotation | Applications > Your App > Settings | Enabled |
| Reuse Interval | Applications > Your App > Settings | 60 seconds |
| Absolute Lifetime | Applications > Your App > Settings | 2592000 (30 days) |
| Inactivity Lifetime | Applications > Your App > Settings | 1296000 (15 days) |
| Grant Types | Applications > Your App > Advanced Settings | Authorization Code, Refresh Token |

### 4. Set Up Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Add your Auth0 credentials:

```env
# Client-side (for React Native app)
# IMPORTANT: Must use EXPO_PUBLIC_ prefix
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your-client-id

# Server-side (for Netlify Functions - optional, for backend verification)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=your-api-identifier
```

### 4. Restart Development Server

After updating `.env`:

```bash
npm start
```

Press `r` to reload or restart the app completely.

## How It Works

### Guest Mode (Default)
- No Auth0 configuration needed
- Automatically generates a local user ID
- Stores quiz results locally
- Works offline

### Authenticated Mode
1. User taps "Login with Auth0" in Settings
2. Opens browser for Auth0 Universal Login
3. User authenticates with Auth0
4. App receives authorization code via redirect
5. Exchanges code for access token AND refresh token using PKCE
6. Fetches user profile from Auth0
7. Stores refresh token securely (iOS Keychain / Android Keystore)
8. All API requests automatically include Bearer token

### Persistent Login (Session Restoration)
When the app launches:
1. App checks for stored refresh token
2. If found, exchanges refresh token for new access token
3. Fetches fresh user profile
4. User is automatically logged in (no need to re-authenticate)
5. If refresh token is expired/invalid, user is logged out and must re-authenticate

### Automatic Token Injection

When authenticated, all API calls in [app/services/api.ts](app/services/api.ts) automatically include:

```
Authorization: Bearer <access-token>
```

This allows your backend to verify the user's identity.

## Testing

### Test Guest Mode
1. Don't configure Auth0 environment variables (or leave them empty)
2. App should work normally
3. Settings should show "Guest User" ID
4. No "Login with Auth0" button should appear

### Test Auth0 Integration
1. Configure Auth0 environment variables in `.env`
2. Restart app (`npm start`)
3. Go to Settings tab
4. "Account" section should appear with "Login with Auth0" button
5. Tap "Login with Auth0"
6. Complete authentication in browser
7. Should redirect back to app
8. Should see user profile in Settings

## URL Scheme

The app uses `pundit-app://` as its URL scheme for Auth0 redirects. This is configured in:
- [app/services/auth0.ts:39](app/services/auth0.ts#L39)
- Auth0 application settings (Allowed Callback/Logout URLs)

## Backend Verification (Optional)

If you want your Netlify Functions to verify Auth0 tokens:

1. Install dependencies:
```bash
npm install jsonwebtoken jwks-rsa
```

2. Set server-side environment variables in Netlify:
   - `AUTH0_DOMAIN`
   - `AUTH0_CLIENT_SECRET` (optional for JWT verification)
   - `AUTH0_AUDIENCE`

3. Create verification utility:

```typescript
// netlify/functions/lib/auth.ts
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}
```

4. Use in your functions:

```typescript
import { verifyToken } from './lib/auth';

export const handler = async (event) => {
  const token = event.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = await verifyToken(token);
      // User is authenticated, decoded contains user info
      const userId = decoded.sub;
    } catch (error) {
      // Invalid token
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }
  }

  // Continue with function logic
};
```

## Troubleshooting

### "Auth0 could not be found" Error
This error occurred with `react-native-auth0` which requires native modules not available in Expo Go. The app now uses `expo-auth-session` which is fully Expo-compatible.

### Login Button Not Appearing
Check that both environment variables are set:
- `EXPO_PUBLIC_AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_CLIENT_ID`

Restart the app after adding them to `.env`.

### Redirect Not Working
Verify that your Auth0 application's Allowed Callback URLs include:
- `pundit-app://*`
- `exp://localhost:8081/--/*` (for Expo Go)

### Authentication Completes But User Not Logged In
Check the console for errors during token exchange. Common issues:
- Incorrect Auth0 domain
- Invalid client ID
- Network issues

### Token Not Being Sent to Backend
Check the Network tab in debugging tools. The `Authorization: Bearer <token>` header should appear in requests to your API when authenticated.

### User Not Staying Logged In (Session Not Persisting)
1. **Check Auth0 Configuration**: Ensure you've enabled refresh tokens in your Auth0 dashboard (see Step 3 above)
2. **Verify Grant Types**: Make sure "Refresh Token" grant type is enabled for your application
3. **Check Token Response**: After login, verify the token response includes a `refresh_token` field
4. **Storage Issues**: On web, tokens are stored in AsyncStorage (less secure). For production web apps, consider server-side session management.

### Refresh Token Expired
If users are being logged out after a period of time:
1. Check your Auth0 **Refresh Token Expiration** settings
2. Increase **Absolute Lifetime** for longer sessions
3. Increase **Inactivity Lifetime** if users are being logged out due to inactivity

## Production Deployment

When deploying to production:

1. **EAS Build**: Set environment variables in `eas.json`:
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

2. **Auth0 Application**: Add production redirect URLs:
```
pundit-app://*
```

3. **Netlify**: Set server-side environment variables in Netlify dashboard

## Migration Path

The app supports both modes simultaneously:
1. Guest mode works without any Auth0 configuration
2. Adding Auth0 credentials enables authentication
3. Users can start as guests and later authenticate to claim their progress (if you implement progress migration)

## Next Steps

1. ✅ Auth0 integration is complete
2. Create `.env` file with your Auth0 credentials (see step 3 above)
3. Test authentication flow
4. Optionally implement backend token verification
5. Deploy to production with production credentials
