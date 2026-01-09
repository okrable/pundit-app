# Frontend Plan

## File & folder structure (proposed)
- app/
  - navigation/ (tab and stack configs)
  - screens/ (DailyQuiz, Leaderboard, Settings, Stats)
  - components/ (quiz cards, option buttons, results panel)
  - state/ (stores, selectors, actions)
  - services/ (API clients, caching)
  - storage/ (local persistence helpers)
  - styles/ (tokens, themes)
  - utils/ (date, formatting, validation)
- assets/ (icons, fonts)

TODO: Adjust folder names to match Expo routing choice if using Expo Router.

## Screens and navigation flow
- Bottom tabs: Games, League Tables, Settings
- Games tab:
  - DailyQuizScreen (default)
  - ResultsPanel shown inline after submit
- League Tables tab:
  - LeaderboardScreen
- Settings tab:
  - SettingsScreen
  - StatsScreen (either inline section or separate route)

## State management strategy
- Use a lightweight client store for cross-screen state (quiz session, results, user stats)
- Keep per-screen UI state local when possible
- Suggested library: Zustand (small surface area, easy persistence)

TODO: Confirm state library preference or existing app standards.

## App states
- Idle (loading daily quiz)
- Quiz ready (questions visible)
- Answering (local selections)
- Submitting
- Results (score, streak, best score, per-question feedback)
- Error (network/validation)

## Component responsibilities
- AppShell: navigation container, theme, safe area handling
- BottomNav: Games, League Tables, Settings
- DailyQuizScreen:
  - Fetch daily quiz
  - Render 5 questions with options
  - Enforce single selection per question
  - Submit button enabled only when all answered
- ResultsPanel:
  - Show score, streak, best score
  - Per-question correct/incorrect feedback
- LeaderboardScreen:
  - Render leaderboard entries (compact list)
- StatsScreen (or Settings sub-section):
  - Personal stats: streak, best score
- SettingsScreen:
  - Placeholder for preferences (TODO)

## State transitions
- Idle -> Quiz ready after fetch success
- Quiz ready -> Answering as user selects options
- Answering -> Submitting on submit
- Submitting -> Results on success
- Submitting -> Error on failure
- Results -> Quiz ready on next day refresh

## LocalStorage keys and rules
- dailyQuizCache:{date} -> cached quiz payload (no correct answers)
- dailyQuizAnswers:{date} -> user selections
- dailyQuizResults:{date} -> server response after submit
- userIdentity -> guestId or userId if provided later

TODO: Confirm storage API (AsyncStorage or secure storage) based on platform/security requirements.
TODO: Confirm whether leaderboards should be cached.

## Offline / guest mode strategy
- Guest mode by default using local userIdentity
- If offline and dailyQuizCache exists for today, allow play and store answers locally
- If offline and no cache exists, show error state with retry
- On reconnect, submit cached answers if not already submitted

TODO: Define conflict rules if the quiz changes after offline play.
