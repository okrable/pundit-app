# Scope: MVP v0.1

## In scope
- One daily 5-question quiz
- Single-screen core pages (no scrolling on core pages)
- Instant results after submission: score, streak, best score
- Simple leaderboards (global or default league placeholder)
- Personal stats view
- Bottom navigation: Games, League Tables, Me
- Clean, modular, production-ready logic and structure

## Implementation Status

### ✅ Fully Implemented
| Feature | Status | Location |
|---------|--------|----------|
| Daily 5-question quiz | ✅ Done | `app/screens/DailyQuizScreen.tsx` |
| Bottom tab navigation | ✅ Done | `app/navigation/BottomTabNavigator.tsx` |
| Quiz fetching from DB | ✅ Done | `netlify/functions/getDailyQuiz.ts` |
| Quiz submission + scoring | ✅ Done | `netlify/functions/submitQuiz.ts` |
| Results display (score, streak, best) | ✅ Done | `app/components/ResultsScreen.tsx` |
| Local quiz caching | ✅ Done | `app/storage/quizCache.ts` |
| Guest user identity | ✅ Done | `app/storage/userStorage.ts` |
| Prevent same-day replay | ✅ Done | `app/storage/quizStorage.ts` |
| Auth0 integration (optional) | ✅ Done | `app/services/auth0.ts` |
| Me profile page | ✅ Done | `app/screens/MeScreen.tsx` |
| Settings modal | ✅ Done | `app/components/SettingsModal.tsx` |

### 🚧 Partially Implemented
| Feature | Status | Notes |
|---------|--------|-------|
| Leaderboard display | 🚧 Partial | UI exists, endpoint returns placeholder data |
| Personal stats | 🚧 Partial | UI exists, endpoint returns placeholder data |
| Streak calculation | 🚧 Partial | Calculated at submit, not persisted |

### ❌ Pending
| Feature | Status | Notes |
|---------|--------|-------|
| Results database table | ❌ Pending | Need to create `results` table in CockroachDB |
| Users database table | ❌ Pending | Need to create `users` table for stats |
| Leaderboard aggregation | ❌ Pending | Need to query results for rankings |
| Duplicate submission prevention | ❌ Pending | Server-side idempotency check |

## Constraints
- Minimalist, compact UI
- Core pages must fit on one screen without scroll
- No assumptions beyond provided requirements; use TODOs where missing
- Database access only via server functions (no direct DB from client)

## Out of scope (do not build)
- Multiple quizzes per day or quiz archives
- ~~User authentication flows (login, signup) unless explicitly provided~~ *Auth0 added as optional*
- Social graph, friends, chat, or messaging
- Push notifications
- In-app purchases or subscriptions
- Admin tooling, CMS, or quiz editor UI
- Complex leagues or seasonal ladders

