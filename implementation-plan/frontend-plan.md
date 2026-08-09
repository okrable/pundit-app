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
  production builds. Games uses the `soccerball` symbol rather than a generic
  home icon.
- Android retains the JavaScript bottom tab navigator.

Web, iOS, and Android are equal acceptance surfaces. Every product, layout, and
behavior change must be considered on all three platforms, even when the
original request or defect names only one. Platform-specific implementations
may differ, but their impact on the other two platforms must be assessed and
validated before the change is complete.

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

The native-tab navigator lives in an `.ios.tsx` module. Web and Android resolve
a safe fallback module that never imports React Navigation's unstable native
tabs entrypoint, because that entrypoint throws when evaluated on web even if
the rendered navigator would later select the drawer. The production web build
also fails if that unsupported runtime is found in the exported JavaScript.

The repository intentionally keeps its native iOS and Android projects rather
than adopting CNG. Expo Doctor's app-config synchronization warning is disabled
for that reason: SDK upgrades apply the generated template diff to both tracked
projects and then regenerate CocoaPods/Gradle inputs while preserving signing,
identifiers, callback schemes, and app resources.

The native tab controller owns the bottom inset. Screens inside the main tab
subtree omit their own bottom safe-area edge only while native tabs are active;
Android, web, Expo Go, and standalone challenge/result routes retain their
existing safe-area handling.

The web navigation drawer keeps dedicated authentication actions anchored in
its footer. Guests see separate Create Account and Log In actions so new
players enter username/avatar onboarding while returning players retain the
login path. Authenticated players see Log Out. All actions use the centralized
Auth0 flow and expose pending and retryable error states.

## Games Hub

The Games tab opens an internal stack with the Daily Quiz as the current
playable mode. The player journey remains implemented for future reuse but its
gallery entry is a Coming Soon concept until live player data is connected. Its
tile retains the headline “Whose journey is this?” and supporting copy “Trace
the clubs. Guess the player.” without artwork or gameplay navigation.

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

Both result surfaces use the same daily share formatter. Quiz numbers are
derived from the London quiz date with 28 September 2025 as number 1; standard
scores use the trophy challenge copy and 500 uses the goat perfect-score copy.

Challenge results use the same compact logo/card/action rhythm as the daily summary, adapted for waiting and head-to-head complete states.

## Shared Gameplay Surface

`QuestionCard` is shared by daily quiz and challenge mode.

Current behavior:

- Persistent compact top bar with logo, score, question count, and progress dots.
- Question content transitions independently so the top bar does not flicker.
- Prompt uses the intentional typewriter effect.
- Answer options fade in one by one after typing completes.
- Timer and answer interaction start only once the prompt and all options are visible.
- Timer remains at zero and allows an answer; correct post-zero answers receive 10 points.
- The first countdown second awards 100 points, followed by two-second 10-point bands down to the minimum.
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

`useQuizStore` owns quiz cache, same-day result cache, immediate result, user identity, pending submission, and identity reconciliation. Daily quiz requests
always include the London quiz date, and cache/network payloads must match that
date and canonical quiz ID before they can replace active state.

Important behaviors:

- Guest results are local-only during guest play.
- Authenticated results submit to the server.
- Guest results can be migrated/adopted after login when no authenticated result already exists.
- Reconciliation resets transient play UI so stale in-progress questions do not flash.

### Games Gallery

`GamesHomeScreen` presents one warm-white game tile per horizontal row on the
orange Games surface. Each row retains the horizontal rail behavior for future
expansion, but currently contains one tile and therefore has no practical
sideways scroll. Each single tile is centred in its row on web, iOS, and
Android; web centres it within the 1200px gallery surface and lets it grow up
to 760px, while native rails centre their narrower card within the device
viewport. The Daily Quiz tile is a single press target: an available tile starts
play and a completed tile opens its cached recap. It uses Uni Sans, its football
treatment, and original tagline with its green action treatment integrated into
the card rather than rendered as a nested button.

The provisional player journey, Starting XI, and The Link Up tiles open one
shared Coming Soon message. The journey tile intentionally has no artwork;
Starting XI and The Link Up retain their code-native icons. Rules and career
components remain available to the game surfaces but are not entry points from
the gallery.

### Profile and Leaderboards

`useProfileStore` and `useLeaderboardStore` render cached data first and
revalidate in the background. Daily leaderboard caches are keyed by quiz date
and friend scope. Profile revalidation discards stale responses if auth state
changes mid-flight. Friends data is forcibly revalidated after accept/remove
mutations and whenever League Tables gains navigation focus, so remote
acceptances do not wait for cache expiry.

Profile resources use cache schema 4 and leaderboard resources use social
cache schema 3. Old payloads are removed lazily while quiz and result storage
remains separate. The daily quiz payload uses cache schema 3 and rejects
cross-date payloads before hydration.
Username onboarding previews the server-assigned football
avatar and opens the shared 58-avatar picker. The authenticated Me avatar opens
the same picker and saves server-confirmed changes into profile and leaderboard
caches.

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
