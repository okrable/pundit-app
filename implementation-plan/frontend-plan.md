# Frontend Plan

## App Structure

The app uses React Navigation, not Expo Router. Its top-level navigator is
selected by platform.

```text
app/
├── components/       # Shared UI: quiz card, results, modals, loading screens
├── constants/        # App constants such as version
├── hooks/            # Bootstrap/auth/font hooks
├── navigation/       # Web drawer, native iOS tabs, and Android bottom tabs
├── screens/          # Daily, Challenge, Leaderboard, Me screens
├── services/         # API, auth flow, Auth0 config, daily prefetch
├── state/            # Zustand stores
├── storage/          # AsyncStorage/SecureStore helpers
├── theme/            # Colors, fonts, spacing
└── types/            # Shared TypeScript interfaces
```

## Adaptive Shell and Navigation

All platforms expose the same primary sections:

- Games
- Challenge
- League Tables
- Me

The shell differs by platform:

- Web uses the full viewport, a full-width orange header, and a warm-white
  drawer opening from the right. The header keeps the Pundit logo on the left,
  the active section centred, and the menu control on the right.
- iOS uses React Navigation's experimental native bottom tabs, backed by
  Apple's tab controller. It uses SF Symbols and the system's automatic
  iPhone/iPad tab-bar or sidebar presentation in development, preview, and
  production builds.
- Android retains the JavaScript bottom tab navigator.

Web breakpoints are compact below 600px, tablet from 600px to 899px, and
desktop at 900px and above. Gutters are 16px, 24px, and 40px respectively.
Authentication content is capped at 560px, gameplay/results and profile
compositions at 760px, lists at 960px, and gallery/header framing at 1200px.
The Games tiles themselves grow to 760px.

Challenge creation and code entry form two columns on desktop. Leaderboards
remain a centred 960px list, while Me and the daily game surfaces retain a
comfortable 760px reading width. Mobile browsers remain single-column.

The native runtime uses Expo SDK 55, React Native 0.83, Reanimated 4.2.1,
Gesture Handler 2.30, and Worklets 0.7.4. Native tabs deliberately use
`react-native-screens` 4.25.x, which supplies the experimental `Tabs.Host`
API required by React Navigation 7. `@react-navigation/bottom-tabs` is pinned
to 7.18.14 because this API is unstable and earlier releases passed the legacy
`tabKey` prop instead of the `screenKey` required by Screens 4.25, causing a
native assertion when changing tabs. The package-level Worklets override keeps
Expo and Reanimated on the same 0.7.4 runtime and Babel plugin rather than
allowing npm to install a second 0.8.x copy beneath Expo.

`react-native-screens` is listed in `expo.install.exclude` so Expo's SDK 55
dependency checker does not replace it with the normally recommended 4.23
line. iOS selects native tabs only when it is not running in Expo Go and the
`Tabs.Host` JavaScript API is present. Otherwise it logs a diagnostic and
uses the existing JavaScript bottom tabs. Native-tab acceptance therefore
requires an EAS development-client or preview build, not Expo Go.

The repository intentionally keeps its native iOS and Android projects rather
than adopting CNG. Expo Doctor's app-config synchronization warning is disabled
for that reason: SDK upgrades apply the generated template diff to both tracked
projects and then regenerate CocoaPods/Gradle inputs while preserving signing,
identifiers, callback schemes, and app resources.

The native tab controller owns the bottom inset. Screens inside the main tab
subtree omit their own bottom safe-area edge only while native tabs are active;
Android, web, Expo Go, and standalone challenge/result routes retain their
existing safe-area handling.

## Games Hub

The Games tab opens an internal stack and displays the Daily Quiz and player
journey as independent mode components. Each component reads its own daily
result: completing the quiz shows its score recap without disabling the career
game, and finding the career player leaves an unplayed quiz available.

The player journey uses the headline “Whose journey is this?”, the supporting
copy “Trace the clubs. Guess the player.”, an illustrated How it works modal,
and a responsive Years/Team/Apps/Goals card with unlimited unscored guesses.

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

`useAuthStore` owns user/token/session state, refresh-token restore, auth-state
versioning, and explicit identity activation state. Canonical public identity
comes from `users.username`; v2 does not expose display-name or username-editing
UI.

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

### Games Gallery

`GamesHomeScreen` presents one warm-white game tile per horizontal row on the
orange Games surface. Each row retains the horizontal rail behavior for future
expansion, but currently contains one tile and therefore has no practical
sideways scroll. On web, the single tile is centred within the 1200px gallery
surface and grows up to 760px. The Daily Quiz and career
tiles are single press targets:
available tiles start play, while completed tiles open their own cached recap.
Their loading, unavailable, and completion states stay independent. The Daily
Quiz uses Uni Sans, its football treatment, and original tagline; the career
tile uses the custom journey artwork. Both integrate their green action
treatment into the card without creating a nested button.

The provisional Starting XI and The Link Up tiles use code-native icons and
open one shared Coming Soon message. They do not add routes, stores,
persistence, or API contracts. Rules components remain available to the game
surfaces but are not entry points from the gallery.

### Profile and Leaderboards

`useProfileStore` and `useLeaderboardStore` render cached data first and
revalidate in the background. Daily leaderboard caches are keyed by quiz date
and friend scope. Profile revalidation discards stale responses if auth state
changes mid-flight. Friends data is forcibly revalidated after accept/remove
mutations and whenever League Tables gains navigation focus, so remote
acceptances do not wait for cache expiry.

Profile and leaderboard resources use dedicated social cache schemas. The daily
payload uses quiz cache schema 2 so clients refresh for `careerGame`, while
stored quiz and career results remain separate and are not cleared.

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
