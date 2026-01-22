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
│   ├── WelcomeScreen.tsx         # Quiz intro screen
│   ├── ResultsScreen.tsx         # Full results display
│   ├── CompletedQuizScreen.tsx   # Already-played state
│   ├── LawsOfTheGameModal.tsx    # Rules info modal
│   └── SettingsModal.tsx         # Settings modal (account, support, about)
├── state/
│   ├── useAuthStore.ts           # Auth0 state (Zustand)
│   └── useQuizStore.ts           # Quiz state (Zustand)
├── services/
│   ├── api.ts                    # API client
│   └── auth0.ts                  # Auth0 configuration
├── storage/
│   ├── userStorage.ts            # User ID persistence
│   ├── quizStorage.ts            # Results caching
│   └── quizCache.ts              # Quiz data caching
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
  loading: boolean;
  error: string | null;
  result: QuizResult | null;
  userStats: UserStats | null;
  userId: string | null;
  // Actions
  setUserId(userId): void;
  fetchQuiz(date?): Promise<void>;
  submitQuizAnswers(answers): Promise<QuizResult>;
  fetchUserStats(): Promise<void>;
  resetQuiz(): void;
}
```

### Local Component State
- Current question index
- User answers array
- Animation states (typewriter, fade-in)
- Modal visibility

---

## App States (Implemented)

| State | Trigger | UI |
|-------|---------|-----|
| Loading | App start / fetch | Loading indicator |
| Welcome | Quiz loaded, not started | WelcomeScreen |
| Answering | User started quiz | QuestionCard sequence |
| Submitting | All questions answered | Loading overlay |
| Results | Submit success | ResultsScreen |
| Completed | Already played today | CompletedQuizScreen |
| Error | Network/API failure | Error message + retry |

---

## Component Responsibilities (Implemented)

### App.tsx
- Font loading with expo-font
- Navigation container
- Safe area handling

### BottomTabNavigator.tsx
- Tab bar configuration
- Screen registration
- Icon assignment (Ionicons)
- Header styling with accent color

### DailyQuizScreen.tsx (322 lines)
- Main orchestrator component
- Checks cached result for same-day replay prevention
- Manages quiz flow state machine
- Handles user ID initialization
- Coordinates between Welcome → Questions → Results

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

### LeaderboardScreen.tsx (179 lines)
- Fetches leaderboard data
- Displays ranked list of players
- Shows score and streak per entry

### MeScreen.tsx
- Profile page with logged-in/logged-out states
- **Logged out**: Account promotion with Create/Login buttons, benefit list
- **Logged in**: Profile picture, display name, streak/best score cards, streak status
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
| `@pundit_daily_quiz_result` | QuizResult JSON | Daily (by date check) | quizStorage.ts |
| `@pundit_quiz_{date}` | Quiz JSON | 24 hours | quizCache.ts |

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
