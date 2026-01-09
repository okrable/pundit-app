# Pundit Trivia v0.1

A daily sports trivia quiz app built with React Native (Expo), TypeScript, and Netlify Functions.

## Features

- Daily quiz with 5 sports trivia questions
- Real-time answer submission and scoring
- Streak tracking and personal best scores
- Global leaderboard
- Offline caching for better performance
- Guest user system (no registration required)

## Tech Stack

### Frontend
- React Native (Expo)
- TypeScript
- React Navigation (Bottom Tabs)
- Zustand (State Management)
- AsyncStorage (Local Persistence)

### Backend
- Netlify Functions (Serverless)
- CockroachDB (PostgreSQL)
- Node.js

## Getting Started

### Prerequisites

- Node.js v20.19.0 or higher
- npm or yarn
- Expo CLI
- CockroachDB instance

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pundit-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure environment variables:
- `DATABASE_URL`: Your CockroachDB connection string
- `AUTH0_*`: Auth0 credentials (optional, for future use)
- `API_BASE_URL`: Your Netlify Functions URL

### Development

1. Start the Expo development server:
```bash
npm start
```

2. Run on iOS:
```bash
npm run ios
```

3. Run on Android:
```bash
npm run android
```

4. Run on Web:
```bash
npm run web
```

5. Test Netlify Functions locally:
```bash
npx netlify dev
```

## Project Structure

```
pundit-app/
├── app/
│   ├── components/       # Reusable UI components
│   ├── navigation/       # Navigation configuration
│   ├── screens/          # Screen components
│   ├── services/         # API service layer
│   ├── state/            # Zustand stores
│   ├── storage/          # AsyncStorage utilities
│   ├── styles/           # Shared styles
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── netlify/
│   └── functions/        # Serverless backend functions
│       ├── lib/          # Shared utilities
│       ├── getDailyQuiz.ts
│       ├── submitQuiz.ts
│       ├── getLeaderboard.ts
│       └── getUserStats.ts
├── implementation-plan/  # Design documents
└── App.tsx               # App entry point
```

## Database Schema

### `public.pu_player_ques`

```sql
CREATE TABLE public.pu_player_ques (
  date DATE NULL,
  language STRING NULL,
  rank INT4 NULL,
  question_id STRING NOT NULL,
  question STRING NULL,
  player_id STRING NULL,
  player_name STRING NULL,
  player_0 STRING NULL,
  player_1 STRING NULL,
  player_2 STRING NULL,
  player_3 STRING NULL,
  CONSTRAINT pu_player_ques_pkey PRIMARY KEY (question_id ASC)
)
```

## API Endpoints

### `GET /.netlify/functions/getDailyQuiz`
Fetch the daily quiz questions.

Query Parameters:
- `date` (optional): YYYY-MM-DD format
- `language` (optional): Language code (default: 'en')

Response:
```json
{
  "id": "quiz-2026-01-08",
  "date": "2026-01-08",
  "questions": [
    {
      "id": "q1",
      "prompt": "Question text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctOptionIndex": 0
    }
  ]
}
```

### `POST /.netlify/functions/submitQuiz`
Submit quiz answers and get results.

Request Body:
```json
{
  "quizId": "quiz-2026-01-08",
  "userId": "guest_12345",
  "answers": [
    {
      "questionId": "q1",
      "selectedOptionIndex": 0
    }
  ]
}
```

Response:
```json
{
  "date": "2026-01-08",
  "quizId": "quiz-2026-01-08",
  "score": 4,
  "totalQuestions": 5,
  "streak": 3,
  "bestScore": 5,
  "answers": [...]
}
```

### `GET /.netlify/functions/getLeaderboard`
Get the global leaderboard.

Response:
```json
[
  {
    "userId": "user123",
    "displayName": "Player 1",
    "score": 5,
    "streak": 10
  }
]
```

### `GET /.netlify/functions/getUserStats`
Get user statistics.

Query Parameters:
- `userId`: User ID

Response:
```json
{
  "streak": 5,
  "bestScore": 5
}
```

## Deployment

### Frontend (Expo)

1. Build for production:
```bash
eas build --platform ios
eas build --platform android
```

2. Submit to app stores:
```bash
eas submit --platform ios
eas submit --platform android
```

### Backend (Netlify)

1. Connect repository to Netlify
2. Configure environment variables in Netlify dashboard
3. Deploy:
```bash
netlify deploy --prod
```

## Environment Variables

See `.env.example` for required environment variables.

## Future Enhancements

- Auth0 authentication (see [AUTH0_SETUP.md](AUTH0_SETUP.md))
- Results and leaderboard database tables
- Push notifications for daily quiz reminders
- Social sharing features
- Multiple quiz categories
- Historical quiz access

## Contributing

1. Follow the implementation plan in `implementation-plan/`
2. Use TypeScript for all new code
3. Follow existing code style and patterns
4. Test on both iOS and Android before submitting

## License

All rights reserved.
# pundit-app
