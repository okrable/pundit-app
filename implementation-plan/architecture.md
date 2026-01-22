# Architecture

## Tech Stack (Confirmed)
**React Native with Expo** - confirmed and implemented.
- Expo SDK 54.0.31 with React Native 0.81.5
- New Architecture enabled
- TypeScript throughout

### Core Dependencies
| Category | Technology | Version |
|----------|------------|---------|
| Framework | React Native + Expo | 0.81.5 / ~54.0 |
| Navigation | @react-navigation/bottom-tabs | ^7.9.0 |
| State | Zustand | ^5.0.9 |
| Storage | @react-native-async-storage/async-storage | ^2.2.0 |
| Auth | expo-auth-session, expo-crypto | ^7.0.10 |
| Database | pg (PostgreSQL client) | ^8.16.3 |
| Build | esbuild (Netlify functions) | - |

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile Client (Expo)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Screens   │  │   Zustand   │  │      AsyncStorage       │ │
│  │  - Daily    │  │   Stores    │  │  - Quiz cache           │ │
│  │  - Leaders  │  │  - Auth     │  │  - Results cache        │ │
│  │  - Settings │  │  - Quiz     │  │  - User ID              │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Netlify Functions (Serverless)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ getDailyQuiz │  │  submitQuiz  │  │ getLeaderboard/Stats │  │
│  │   ✅ Done    │  │   ✅ Done    │  │    🚧 Placeholder    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ PostgreSQL wire protocol (SSL)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CockroachDB                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ public.pu_player_ques  ✅ EXISTS                         │  │
│  │   - date, question_id, question, player_name             │  │
│  │   - player_0, player_1, player_2, player_3 (options)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ results table          ❌ NOT CREATED                    │  │
│  │ users table            ❌ NOT CREATED                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Separation of concerns
- **Frontend**: UI rendering, local session state, input validation, display logic
- **Netlify Functions**: all DB access, daily quiz selection, scoring verification
- **Database**: persistent storage of quizzes *(results/users tables pending)*

## Environment Configuration (Implemented)

### File: `.env` (not committed) / `.env.example` (template)

```bash
# Server-side only (Netlify Functions)
DATABASE_URL=postgresql://user:pass@host:26257/db?sslmode=verify-full
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_SECRET=secret
AUTH0_AUDIENCE=https://api.example.com

# Client-side (Expo - EXPO_PUBLIC_ prefix required)
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=client_id
EXPO_PUBLIC_API_BASE_URL=https://site.netlify.app/.netlify/functions
```

### Netlify Configuration (`netlify.toml`)
```toml
[build]
  functions = "netlify/functions"
  publish = "netlify/static"

[functions]
  node_bundler = "esbuild"
```

## Backend and Database Integration

### Current Implementation
- **Database driver**: `pg` (node-postgres) with SSL
- **Connection pooling**: Singleton Pool in `netlify/functions/lib/db.ts`
- **Quiz selection**: By `date` column (YYYY-MM-DD format) and `language` (default: 'uk')

### Quiz Fetch Flow
1. Client requests `/getDailyQuiz?date=YYYY-MM-DD`
2. Server queries `pu_player_ques` table filtered by date
3. Server builds question objects with options from `player_0`-`player_3`
4. Server calculates `correctOptionIndex` by matching `player_name`
5. Returns quiz with questions (correct answers included for simplicity)

### Submit Flow
1. Client POSTs answers to `/submitQuiz`
2. Server fetches correct answers from DB
3. Server compares selections, calculates score
4. Server returns result with per-question feedback
5. **TODO**: Persist results to database
6. **TODO**: Calculate streak from historical results
7. **TODO**: Prevent duplicate submissions

## Trust Boundaries
- **Untrusted**: Mobile client (cannot be trusted for scoring)
- **Trusted**: Netlify Functions (enforce rules, compute results)
- **Data**: CockroachDB only accessible via Netlify Functions (no direct client access)

## Date/Time Handling
- **Current**: Server uses date from query param or defaults to UTC date
- **Client caching**: 24-hour expiry based on quiz date
- **TODO**: Implement London timezone (Europe/London) for quiz resets

