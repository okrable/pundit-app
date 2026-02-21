# Execution Plan

## Phase 1: Project Setup ✅ COMPLETE
- [x] Initialize React Native (Expo) project
- [x] Add navigation and storage dependencies
- [x] Set up folder structure per plan
- [x] **Validation**: app boots, tab navigation works

**Implementation Notes**:
- Expo SDK 54.0.31, React Native 0.81.5
- @react-navigation/bottom-tabs for navigation
- Zustand for state management
- AsyncStorage for persistence
- TypeScript configured

---

## Phase 2: Daily Quiz UI ✅ COMPLETE
- [x] Build DailyQuizScreen layout
- [x] Implement local state for answers
- [x] Add submit button state rules
- [x] **Validation**: UI works on iOS/Android

**Implementation Notes**:
- Changed from "all 5 questions visible" to one-at-a-time flow
- Added typewriter animation for question text
- Added staggered fade-in for options
- Auto-advance after 2-second delay
- Added WelcomeScreen before quiz starts

---

## Phase 3: API Integration ✅ COMPLETE
- [x] Implement getDailyQuiz function
- [x] Wire client fetch with loading/error states
- [x] **Validation**: can fetch and render quiz

**Implementation Notes**:
- Netlify Function at `/getDailyQuiz`
- Queries CockroachDB `pu_player_ques` table
- Returns questions with correctOptionIndex (slight deviation from plan)
- Client caches quiz data for 24 hours

---

## Phase 4: Submit Flow ✅ COMPLETE
- [x] Implement submitDailyQuiz function
- [x] Client submits answers and renders results
- [x] **Validation**: score and per-question feedback appear

**Implementation Notes**:
- Netlify Function at `/submitQuiz`
- Server verifies answers against DB
- Returns score, answers with isCorrect flags
- For Auth0 users: persists to database with real streak/bestScore
- For guests: placeholder values (no DB interaction)
- Results cached locally to prevent same-day replay
- Idempotent submission (returns cached result if already submitted)

---

## Phase 5: Stats and Leaderboards ✅ COMPLETE
- [x] Implement leaderboard fetch + render
- [x] Implement personal stats display
- [x] **Validation**: shows real data from database

**Implementation Notes**:
- LeaderboardScreen UI complete with real daily data
- MeScreen shows stats from database (Auth0 users)
- Guest users see placeholder zeros (intentional - incentivizes signup)
- Leaderboard shows daily rankings from results table
- Guest prompt banner added to LeaderboardScreen to encourage signup
- See `features/users-results-integration.md` for full details

---

## Phase 6: Caching + Offline Resilience ✅ COMPLETE
- [x] Cache daily quiz locally
- [x] Cache results locally
- [x] Graceful fallback when offline (partial)
- [x] **Validation**: app shows cached quiz/results without network

**Implementation Notes**:
- Quiz cached in `@pundit_quiz_{date}` (24-hour expiry)
- Results cached in `@pundit_daily_quiz_result`
- Same-day replay prevention via cached result date check
- **Not implemented**: Offline answer queue for later submission

---

## Phase 7: Cleanup and Production Readiness 🚧 PARTIAL
- [x] Error handling for API failures
- [x] Loading states throughout
- [x] Harden edge cases (submit validation + stats fix + secure code generation + log cleanup)
- [ ] Remove debug UI (if any)
- [ ] **Validation**: app meets scope and constraints

**Implementation Notes**:
- Basic error handling in place
- Custom ApiError class with status codes
- Theme system with consistent styling
- **TODO**: Add error boundaries
- Added input validation in submitQuiz for malformed payloads and duplicate answers

---

## Additional Work Completed (Beyond Original Plan)

### Auth0 Integration ✅
- Optional authentication via Auth0
- Graceful degradation if not configured
- useAuthStore manages auth state
- MeScreen has login/logout

### Theme System ✅
- Custom fonts (Gotham, UniSans)
- Color palette defined
- Spacing and border radius tokens
- Consistent styling across screens

### Animations ✅
- Typewriter effect for questions (with tap-and-hold speed-up)
- Staggered option fade-in
- Correct/incorrect highlighting

### Database Integration ✅
- `users` table for profiles and stats
- `results` table for quiz submissions
- Streak calculation from consecutive days
- Best score tracking
- Idempotent submissions
- See `features/users-results-integration.md`

### "Me" Profile Page ✅
- Replaced Settings tab with Me tab
- Settings moved to modal (cog icon)
- Logged-in: profile picture, name, streak/best stats
- Logged-out: signup prompt with benefits
- See `features/me-profile-page.md`

---

## Remaining Work

### Medium Priority
1. London timezone for quiz resets
2. Server-side Auth0 token validation and user ownership checks
3. Fair-play API contract: stop returning correct answers in daily quiz payload

### Low Priority
4. Error boundaries in React
5. Offline answer queue
6. Analytics/telemetry

---

## Dependencies (Implemented)

```json
{
  "expo": "~54.0.31",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "@react-navigation/bottom-tabs": "^7.9.0",
  "@react-navigation/native": "^7.1.26",
  "zustand": "^5.0.9",
  "@react-native-async-storage/async-storage": "^2.2.0",
  "expo-auth-session": "^7.0.10",
  "expo-crypto": "^15.0.8",
  "expo-font": "~14.0.2",
  "pg": "^8.16.3"
}
```


## Hardening PR Breakdown

- **PR A (this branch)**: Low-risk backend hardening (submit validation, total_correct accounting fix, secure friend-code RNG, and daily quiz debug log cleanup).
- **PR B**: Auth enforcement on protected endpoints (JWT verification and userId ownership checks).
- **PR C**: Timezone consistency for daily quiz/streak/leaderboard calculations.
- **PR D**: Fair-play payload change to remove daily quiz answer leakage.
