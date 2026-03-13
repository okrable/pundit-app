# Frontend Plan

## File & Folder Structure (Implemented)

```
app/
├── navigation/
│   └── BottomTabNavigator.tsx    # Tab navigation config
├── screens/
│   ├── DailyQuizScreen.tsx       # Main quiz orchestrator
│   ├── LeaderboardScreen.tsx     # Leaderboard display
│   └── MeScreen.tsx              # Profile page (logged in/out states)
├── components/
│   ├── QuestionCard.tsx          # Question UI with animations
│   ├── BootstrapScreen.tsx       # Branded startup loading screen
│   ├── WelcomeScreen.tsx         # Quiz intro screen
│   ├── ResultsScreen.tsx         # Full results display
│   ├── CompletedQuizScreen.tsx   # Already-played state
│   ├── LawsOfTheGameModal.tsx    # Rules info modal
│   └── SettingsModal.tsx         # Settings modal (account, support, about)
├── state/
│   ├── useAuthStore.ts           # Auth0 state (Zustand)
│   ├── useQuizStore.ts           # Quiz + result sync state
│   ├── useProfileStore.ts        # Cached-first profile stats state
│   └── useLeaderboardStore.ts    # Cached-first leaderboard state
├── services/
│   ├── api.ts                    # API client
│   ├── auth0.ts                  # Auth0 configuration
│   └── dailyLoop.ts              # Daily-loop bootstrap/prefetch
├── storage/
│   ├── userStorage.ts            # User ID persistence
│   ├── quizStorage.ts            # Results caching
│   ├── quizCache.ts              # Quiz data caching
│   ├── profileCache.ts           # Profile stats caching
│   ├── leaderboardCache.ts       # Leaderboard caching
│   ├── pendingSubmission.ts      # Pending daily quiz submit retry
│   └── resourceCache.ts          # Generic cache envelope helpers
├── theme/
│   └── theme.ts                  # Colors, fonts, spacing
├── types/
│   └── index.ts                  # TypeScript interfaces
├── hooks/
│   └── useFonts.ts               # Font loading hook
├── styles/                       # (empty - using inline styles)
└── utils/                        # (empty)

assets/
├── fonts/                        # Gotham, UniSans
├── images/
├── logo/
└── favicon/
```

*Note: Not using Expo Router - using @react-navigation*

---

## Screens and Navigation Flow (Implemented)

### Bottom Tabs
```
┌─────────────┬─────────────────┬─────────────┐
│   Games     │  League Tables  │     Me      │
│  (football) │    (trophy)     │  (person)   │
└─────────────┴─────────────────┴─────────────┘
```

### Games Tab Flow
```
DailyQuizScreen
    │
    ├── [First visit today] → WelcomeScreen → QuestionCard (x5) → ResultsScreen
    │
    └── [Already played today] → CompletedQuizScreen (cached result)
```

### Question Flow Detail
- Questions shown one at a time (not all 5 visible)
- Auto-advance after 2-second delay on answer
- Typewriter effect for question text (30ms per char)
- Staggered fade-in for answer options

---

## State Management (Implemented)

### Zustand Stores

**useAuthStore** (`app/state/useAuthStore.ts`)
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuth0Available: boolean;
  error: string | null;
  // Actions
  setAuthResult(token, user): void;
  logout(): void;
  clearError(): void;
}
```

**useQuizStore** (`app/state/useQuizStore.ts`)
```typescript
interface QuizState {
  quiz: Quiz | null;
  quizCache: CacheEnvelope<Quiz> | null;
  cachedResult: CachedQuizResult | null;
  result: QuizResultImmediate | null;
  userId: string | null;
  isQuizLoading: boolean;
  isSubmitting: boolean;
  setUserId(userId): void;
  hydrateFromCache(userId): Promise<void>;
  fetchQuiz(date?): Promise<Quiz | null>;
  createLocalResult(answers): Promise<QuizResultImmediate | null>;
  submitQuizAnswers(answers): Promise<void>;
  retryPendingSubmission(): Promise<void>;
  resetQuiz(): void;
}
```

**useProfileStore / useLeaderboardStore**
- Own cached-first warm rendering for Me and League Tables.
- Revalidate in the background after app bootstrap, focus, auth changes, and quiz completion.

### Local Component State
- Current question index
- User answers array
- Animation states (typewriter, fade-in)
- Modal visibility

---

## App States (Implemented)

| State | Trigger | UI |
|-------|---------|-----|
| Bootstrap | App start | Branded bootstrap screen |
| Welcome | Quiz cached or warming, not started | WelcomeScreen |
| Answering | User started quiz | QuestionCard sequence |
| Syncing | All questions answered | ResultsScreen with background sync status |
| Results | Local result ready | ResultsScreen |
| Completed | Already played today | CompletedQuizScreen |
| Error | Network/API failure | Inline retry / helper text |

---

## Component Responsibilities (Implemented)

### App.tsx
- Font loading with expo-font
- Branded startup bootstrap while local daily-loop state hydrates
- Navigation container
- Safe area handling

### BottomTabNavigator.tsx
- Tab bar configuration
- Screen registration
- Icon assignment (Ionicons)
- Header styling with accent color

### DailyQuizScreen.tsx
- Main daily-loop orchestrator
- Renders Welcome or Completed immediately from cached state
- Preloads quiz in the background before kickoff
- Reveals local result instantly, then syncs submit/final stats in background

### QuestionCard.tsx (205 lines)
- Single question display
- Typewriter animation for prompt text
- Staggered option button fade-in
- Correct/incorrect highlighting
- 2-option row layout (48% width each)

### WelcomeScreen.tsx (106 lines)
- Logo display
- "Kick Off" start button
- "Laws of the Game" info modal trigger
- Styled with accent color background

### ResultsScreen.tsx (248 lines)
- Score display (X/5 and percentage)
- Streak and best score stats
- Answer review with ⚽️ (correct) / ❌ (incorrect)
- Dynamic feedback messages based on score
- "Play Again" button (resets quiz)

### CompletedQuizScreen.tsx
- Shows cached result for users who already played
- Prevents replaying until next day
- Uses same score display as ResultsScreen

### LeaderboardScreen.tsx
- Hydrates cached friends/global leaderboards first
- Uses placeholder rows instead of centered spinners on empty warm loads
- Keeps Friends as the primary authenticated comparison view

### MeScreen.tsx
- Cached-first profile page with logged-in/logged-out states
- Logged-in stats render from cache immediately and refresh silently on focus
- Settings cog button opens SettingsModal

### SettingsModal.tsx
- Modal accessed via cog icon in MeScreen header
- "Done" button to dismiss
- Account section (name, email, sign out) - only when logged in
- Support section (feedback link, donation)
- About section (version info)
- Guest options (clear quiz) - only when logged out

---

## State Transitions (Implemented)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────┐    fetch    ┌─────────────┐                    │
│  │ Loading │────────────▶│   Welcome   │                    │
│  └─────────┘             └──────┬──────┘                    │
│       │                         │                            │
│       │ cached result           │ "Kick Off"                 │
│       ▼                         ▼                            │
│  ┌───────────┐           ┌───────────┐    all answered      │
│  │ Completed │           │ Answering │─────────────────┐    │
│  └───────────┘           └───────────┘                 │    │
│                                                        ▼    │
│                          ┌───────────┐           ┌─────────┐│
│                          │  Results  │◀──────────│Submitting│
│                          └───────────┘           └─────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## AsyncStorage Keys (Implemented)

| Key | Content | Expiry | File |
|-----|---------|--------|------|
| `@pundit_user_id` | Guest ID string | Never | userStorage.ts |
| `@pundit_daily_quiz_result_*` | Same-day result JSON | Daily (by date check) | quizStorage.ts |
| `@pundit_resource_quiz_{date}` | Quiz JSON envelope | stale-first / timed | quizCache.ts |
| `@pundit_resource_profile_{userId}` | UserStats envelope | stale-first / timed | profileCache.ts |
| `@pundit_resource_leaderboard_*` | Leaderboard envelope | stale-first / timed | leaderboardCache.ts |
| `@pundit_pending_daily_submission` | Pending submit payload | until sync success | pendingSubmission.ts |

---

## Offline / Guest Mode (Implemented)

### Guest Mode
- Default mode - no login required
- Auto-generated ID: `guest_{timestamp}_{random}`
- ID persisted in AsyncStorage

### Auth0 Mode (Optional)
- Configured via EXPO_PUBLIC_AUTH0_* env vars
- Graceful degradation if not configured
- Auth0 user ID used when authenticated

### Offline Handling
- Quiz data cached for 24 hours
- Results cached locally after submission
- Same-day replay prevented via cached result date check
- **Not implemented**: Offline answer storage for later submission

---

## Theme System (Implemented)

**File**: `app/theme/theme.ts`

```typescript
colors: {
  background: '#F9F6ED',    // Beige
  primary: '#34855b',       // Green
  accent: '#d07158',        // Orange/coral
  correct: '#4CAF50',       // Green
  incorrect: '#F44336',     // Red
  textDark: '#2f2926',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#9E9E9E'
}

fonts: {
  gothamBlack, gothamBold, gothamMedium, gothamBook, gothamLight,
  uniSansHeavy, uniSansThin
}

spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
borderRadius: { sm: 8, md: 12, lg: 16, xl: 24 }
```

---

## Animations (Implemented)

| Animation | Location | Timing |
|-----------|----------|--------|
| Typewriter text | QuestionCard | 30ms per character |
| Option fade-in | QuestionCard | Staggered 100ms delay |
| Auto-advance | DailyQuizScreen | 2000ms after answer |
| Correct/incorrect highlight | QuestionCard | Immediate on selection |
