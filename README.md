# Pundit Trivia v2.1.0

Pundit Trivia is a daily football quiz app built with Expo React Native, TypeScript, Netlify Functions, and CockroachDB.

## Current Product

- Daily 5-question football quiz with typewriter prompt pacing.
- Shared refreshed gameplay UI for daily quiz and challenge mode.
- Reanimated question transitions, option reveal, circular timer, and answer reveal states.
- Games hub with independently completed Daily Quiz and player-journey modes.
- Daily player journey with an illustrated career table, unlimited name guesses,
  spelling normalization, and separate guest/authenticated completion storage.
- Timer starts only after the question and options are visible.
- Players can still answer after the timer reaches zero; correct post-zero answers receive the minimum score.
- Compact post-quiz daily summary with final score, answer recap, and native text sharing.
- Cached completed screen for already-played daily quizzes.
- Guest play by default, with local-only guest daily results.
- Auth0 sign-in for profile stats, leaderboards, friends, and challenge mode.
- Guest-to-auth daily result reconciliation after login.
- Centralized auth flow with login, quiz reconciliation, and first data prefetch behind a loading interstitial.
- Blocking, resumable username onboarding before authenticated players enter the app.
- Username-only Me profile and public identity; usernames are permanent after selection.
- Results-backed current streak status with active, at-risk, and inactive states.
- Canonical server-side username identities, with legacy display-name fields retained temporarily for installed-client compatibility.
- Daily global leaderboard, mutual friendships with reusable seven-day invite links, and async challenge mode.
- Server-resolved challenge usernames and username-only persisted leaderboard ranking eligibility.
- Stale-first cache hydration for quiz, result, profile, and leaderboard warm loads.
- Forced friends-leaderboard refresh when League Tables gains focus or a friendship changes.
- Mobile-first web layout that mirrors the native bottom-tab app shell.
- Date-aware daily leaderboard caches with forced background refresh after authenticated submissions.

## Versioning

- Current app/docs version: `2.1.0`.
- `package.json`, `package-lock.json`, `app.json`, `app/constants/version.ts`,
  and native iOS/Android marketing versions must stay aligned.
- Settings displays the app version from `APP_VERSION`.
- Release history is tracked in `CHANGELOG.md`.

## Tech Stack

- Expo React Native
- TypeScript
- React Navigation
- Zustand
- AsyncStorage and Expo SecureStore
- Expo AuthSession with Auth0
- React Native Reanimated
- Netlify Functions
- CockroachDB/PostgreSQL via `pg`

## Getting Started

### Prerequisites

- Node.js `>=20.19.4`
- npm
- Expo CLI via `npx expo`
- CockroachDB database
- Netlify CLI for local function development

### Install

```bash
npm install
```

Create local environment variables from `.env.example`:

```bash
cp .env.example .env
```

Important variables:

- `DATABASE_URL`
- `AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_CLIENT_ID`
- `EXPO_PUBLIC_API_BASE_URL`
- `QUIZ_TIMEZONE`
- `EXPO_PUBLIC_QUIZ_TIMEZONE`

## Development

Start the Expo app:

```bash
npm start
```

Run native targets:

```bash
npm run ios
npm run android
```

Run local Netlify functions:

```bash
npm run dev:functions
```

Capture the latest app/server run in a wipe-on-start log file:

```bash
npm run log:web
```

The wrapper mirrors output to the terminal and writes the current run to `runtime/last-run.log`.

Point the app at local functions:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:9999/.netlify/functions
```

Fast mobile loop with cache clear:

```bash
npm run dev:mobile
```

## Delivery Workflow

- `main` is the only permanent and production-significant branch.
- Create short-lived, purpose-named branches from the latest `main`.
- Open pull requests against `main`; Netlify supplies the web Deploy Preview.
- All non-main branches use the same preview configuration regardless of branch name.
- Use the same commit for responsive web checks and any required EAS iOS preview build.
- CI requires unit tests, TypeScript validation, and a successful web export before merge.
- Production deploys only from `main`.

Preview builds display a badge in Settings. Web previews call their own deployed
Functions, and generated friend/challenge URLs remain in the preview environment.
Preview and production Functions share the configured CockroachDB/Auth0 services,
so testing uses designated accounts and schema changes must remain backward-compatible.

## Device Builds and TestFlight

This project uses EAS Build for installable iOS builds and TestFlight submissions.

Before the first TestFlight upload, decide the permanent iOS bundle identifier. The current value is `com.anonymous.pundittemp`; App Store Connect app records must match that value exactly, and changing it later means creating a different app identity. Because this repo has native `ios/` and `android/` folders, keep native IDs aligned with `app.json` when changing them.

Log in to Expo:

```bash
npm run eas:login
```

Build for the iOS Simulator without an Apple Developer membership:

```bash
npx eas-cli@latest env:set preview \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value <deploy-preview-origin>/.netlify/functions \
  --visibility plaintext \
  --scope project
npm run build:ios:simulator
```

Simulator builds provide the native-app build gate when no paid Apple Developer
team is available. Full Xcode is required to install and run the resulting app
locally. Set the preview API URL to the current PR's Netlify Deploy Preview
before each build so native and web testing exercise the same commit. EAS embeds
`EXPO_PUBLIC_` values in the app bundle; an ignored local `.env` file is not
available to the remote builder.

Install a build on your own iPhone first:

```bash
npm run build:ios:device
```

The EAS dashboard build page will provide an install link/QR code. iOS device
and TestFlight builds require a paid Apple Developer membership. For internal
distribution, EAS may ask to register your device UDID and create ad hoc signing
credentials.

Send a build to TestFlight:

```bash
npm run build:ios:testflight
```

This creates a production iOS archive and submits it to App Store Connect. TestFlight requires a paid Apple Developer account and an App Store Connect app record whose bundle identifier matches `app.json`. After Apple processes the upload, add internal testers in App Store Connect. External friends can be invited through an external TestFlight group after the first Beta App Review.

## Project Structure

```text
pundit-app/
├── app/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── state/
│   ├── storage/
│   ├── theme/
│   └── types/
├── assets/
├── db/
├── implementation-plan/
├── netlify/functions/
├── AUTH0_SETUP.md
└── CHANGELOG.md
```

## Daily Quiz Flow

1. App hydrates cached daily-loop resources.
2. Games tab shows independent launch or recap components for the Daily Quiz
   and player journey.
3. Kick Off enters the existing Daily Quiz directly; the question prompt types
   out intentionally before answer options appear.
4. Timer starts after all options are visible.
5. Answer tap locks the choice, pauses briefly, reveals correctness, then transitions to the next question.
6. After the fifth answer, the app durably saves the result, updates the
   projected streak, and shows the daily summary immediately.
7. Authenticated plays submit in the background with one transient retry;
   guest plays remain local until migrated after login.

## Auth and Guest Model

- Guests can play the daily quiz without registration.
- Guest daily results are stored locally and do not call `submitQuiz` immediately.
- Interactive login owns its activation path; bootstrap activates only sessions
  restored from storage, and stale activation results are discarded after
  logout, token changes, or account switches.
- After login, the centralized auth flow reconciles identity before releasing the UI:
  - authenticated local/server result wins if present;
  - otherwise a valid guest result is migrated to the authenticated user;
  - stale guest cache is cleared after reconciliation.
- Username onboarding is shown only when the synchronized profile explicitly
  reports `username_required`; other sync work uses the normal auth handoff.
- Logout clears the local app session without opening the Auth0 browser logout flow.

## API Surface

Netlify Functions live under `/.netlify/functions/`.

Core groups:

- Daily games: `getDailyQuiz`, `submitQuiz`, `getTodayResult`,
  `completeCareerGame`, `getTodayCareerGameResult`, `migrateGuestResult`
- Identity/profile: `syncIdentity`, `getUserStats`, `updateProfile`, `checkUsername`, `setUsername`
- Leaderboards: `getLeaderboard`, `getFriendsLeaderboard`
- Friends: `createFriendLink`, `acceptFriendLink`, `getFriends`, `removeFriend`
- Challenges: `createChallenge`, `getChallenge`, `joinChallenge`, `submitChallengeAnswers`, `revokeChallenge`, `getUserChallenges`
- Operations: `trackEvent`

Protected endpoints validate Auth0 bearer tokens server-side and enforce `token.sub === userId`.
Protected social actions require a completed identity with a username. The
client synchronizes identity before reconciliation and navigation, then blocks
incomplete accounts on username selection.

## Debugging

- Settings includes `Copy Debug Log` and `Clear Debug Log`.
- Debug logs cover startup, auth, bootstrap, daily-loop, API, and reconciliation events.
- Use `npx tsc --noEmit` before handing off changes.

## Canonical Planning Docs

The `implementation-plan/` folder is the current implementation source of truth. Update it in the same change as meaningful behavior changes.

## Future Work

- Operational alerts and error-budget reporting from structured API logs.
- Push notifications.
- Quiz archives and historical play.
- Funnel reporting from anonymous aggregate analytics events.

## License

All rights reserved.
