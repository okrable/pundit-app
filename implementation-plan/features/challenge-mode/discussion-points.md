# Challenge Mode - Discussion Points

Quick reference for planning discussions. See [README.md](./README.md) for full details.

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Active challenges per user | **1 at a time** |
| Quiz source | **Today's daily quiz** (future: random) |
| Scoring/ties | **Compare scores, draws allowed** |
| Revocable | **Yes, before opponent joins** |
| Challenge expiry | **48 hours** |
| History visible | **Last 10 completed** (Auth0 only) |
| Lifetime stats | **Win/Loss/Draw on profile** (Auth0 only) |
| Guest users | **Can play, nothing persisted** |
| Repeat opponents | **No restrictions** |

---

## Database Design

### Extend `users` table:
```sql
ALTER TABLE users ADD COLUMN challenge_wins INT DEFAULT 0;
ALTER TABLE users ADD COLUMN challenge_losses INT DEFAULT 0;
ALTER TABLE users ADD COLUMN challenge_draws INT DEFAULT 0;
```

### New `challenges` table:
- Single row per challenge (both players' data in one row)
- Status: `pending` → `active` → `completed` (or `expired`/`revoked`)
- Stores scores and answers for both creator and opponent
- `winner_id` NULL means draw

See [README.md](./README.md) for full schema.

---

## API Endpoints (6 new)

| Endpoint | Purpose |
|----------|---------|
| `POST /createChallenge` | Create new challenge (fails if user has active one) |
| `GET /getChallenge` | Get challenge details by code |
| `POST /joinChallenge` | Join challenge as opponent |
| `POST /submitChallengeAnswers` | Submit quiz answers |
| `POST /revokeChallenge` | Cancel challenge (creator only, before opponent joins) |
| `GET /getUserChallenges` | Get active + history + stats |

---

## Core Flow Recap

```
Player A creates challenge → gets ABC123 code
        ↓
Player A shares code/link
        ↓
Player A plays today's quiz (score hidden)
        ↓
Player B joins with code
        ↓
Player B plays same 5 questions
        ↓
Both see results: Win/Loss/Draw
Stats updated on both profiles
```

---

---

## Implementation Phases

### Phase 1: Database
- [ ] Add columns to `users` table (wins/losses/draws)
- [ ] Create `challenges` table
- [ ] Write migration scripts

### Phase 2: API
- [ ] `/createChallenge` endpoint
- [ ] `/getChallenge` endpoint
- [ ] `/joinChallenge` endpoint
- [ ] `/submitChallengeAnswers` endpoint
- [ ] `/revokeChallenge` endpoint
- [ ] `/getUserChallenges` endpoint

### Phase 3: UI
- [ ] Challenge tab/screen
- [ ] Create challenge flow + share
- [ ] Join challenge flow
- [ ] Challenge quiz (reuse daily quiz UI)
- [ ] Results comparison screen
- [ ] Challenge history list

### Phase 4: Polish
- [ ] Deep linking (`pundit.app/c/CODE`)
- [ ] Expiry job (mark old challenges as expired)
- [ ] Error states and edge cases
