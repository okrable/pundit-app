# Frontend Plan

## App Structure

The app uses React Navigation bottom tabs, not Expo Router.

```text
app/
├── components/       # Shared UI: quiz card, results, modals, loading screens
├── constants/        # App constants such as version
├── hooks/            # Bootstrap/auth/font hooks
├── navigation/       # Bottom tab navigator
├── screens/          # Daily, Challenge, Leaderboard, Me screens
├── services/         # API, auth flow, Auth0 config, daily prefetch
├── state/            # Zustand stores
├── storage/          # AsyncStorage/SecureStore helpers
├── theme/            # Colors, fonts, spacing
└── types/            # Shared TypeScript interfaces
```

## Navigation

Bottom tabs:

- Games
- Challenge
- League Tables
- Me

## Daily Quiz Flow

```text
DailyQuizScreen
├── AuthSyncScreen                    # login/reconciliation or identity handoff
├── WelcomeScreen                     # first visit, quiz ready or warming
├── QuestionCard x5                   # active quiz play
├── ResultsScreen                     # immediate post-quiz summary
└── CompletedQuizScreen               # already-played cached state
```

The immediate summary is shown only after completing a daily quiz in the current session. Returning later uses the completed/cached state.

Challenge results use the same compact logo/card/action rhythm as the daily summary, adapted for waiting and head-to-head complete states.

## Shared Gameplay Surface

`QuestionCard` is shared by daily quiz and challenge mode.

Current behavior:

- Persistent compact top bar with logo, score, question count, and progress dots.
- Question content transitions independently so the top bar does not flicker.
- Prompt uses the intentional typewriter effect.
- Answer options fade in one by one after typing completes.
- Timer starts only once the prompt and options are visible.
- Timer remains at zero and allows an answer; correct post-zero answers receive minimum score.
- Answer tap locks options, shows a short suspense beat, then reveals correctness.
- Locked/correct/incorrect message copy is selected as linked pairs by index.
- Correct answer reveal uses repeated pulse; wrong answers do not shake.
- Between questions, the question content zoom-fades out, pauses, then the next question begins.
- Challenge mode keeps the same full-window card proportions as daily quiz, with only a small neutral challenge context pill above the shared card.

## State Management

### Auth

`useAuthStore` owns user/token/session state, refresh-token restore, auth-state versioning, and permanent username setup.

Login/logout orchestration lives in `app/services/authFlow.ts`:

- prompts Auth0 once;
- exchanges the authorization code once with PKCE;
- stores credentials through `useAuthStore`;
- reconciles guest/auth quiz state;
- prefetches first daily-loop data before releasing the UI.

### Quiz

`useQuizStore` owns quiz cache, same-day result cache, immediate result, user identity, pending submission, and identity reconciliation.

Important behaviors:

- Guest results are local-only during guest play.
- Authenticated results submit to the server.
- Guest results can be migrated/adopted after login when no authenticated result already exists.
- Reconciliation resets transient play UI so stale in-progress questions do not flash.

### Profile and Leaderboards

`useProfileStore` and `useLeaderboardStore` render cached data first and revalidate in the background. Leaderboard caches are separated by daily/weekly period and friend scope. Profile revalidation discards stale responses if auth state changes mid-flight.

The Me screen is a stats-led profile surface. Authenticated users without a username must complete the welcome setup modal, choose a permanent username, and accept the under-development notice before normal profile use. Username is the only player-facing identity across profile, leaderboards, friends, and challenges.

## Settings

Settings includes:

- authenticated account section and sign out;
- support links;
- debug-log copy/clear controls;
- app version from `APP_VERSION`;
- guest-only quiz cache reset.

Authenticated users do not see guest options.

## Theme and Animation

- Theme values live in `app/theme/theme.ts`.
- Gameplay animation uses React Native Reanimated and Worklets.
- The timer preserves the circular countdown concept with smoother progress and urgency styling.
- Avoid parent-level remount keys around `QuestionCard`; only the question content should remount for per-question animation.
