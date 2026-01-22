# Assumptions and TODOs

## Resolved Assumptions

| Original Assumption | Resolution |
|---------------------|------------|
| No assumption of authentication | ✅ Auth0 added as optional, guest mode is default |
| No assumption of existing schema | ✅ Discovered `pu_player_ques` table exists |
| No assumption of existing API endpoints | ✅ Created Netlify Functions from scratch |
| No assumption of analytics | ✅ No analytics added (out of scope) |

---

## Resolved Questions

| Question | Answer |
|----------|--------|
| How are quizzes stored in CockroachDB? | `pu_player_ques` table with date, question, player options |
| Is there an existing backend? | No - Netlify Functions created from scratch |
| User identity model? | Guest by default (auto-generated ID), optional Auth0 |
| Leaderboard scope? | Global (single leaderboard for all users) |
| Historical results retention? | Not yet implemented - results table needed |

---

## Resolved Inputs

| Input | Resolution |
|-------|------------|
| Data source details | CockroachDB with `pu_player_ques` table |
| Netlify Functions deployment | `netlify/functions/` directory, esbuild bundler |
| DB connection | `DATABASE_URL` env var, pg driver with SSL |
| UX copy and branding | Implemented with Gotham/UniSans fonts, coral/green theme |
| Target devices | iOS and Android via Expo |

---

## Remaining TODOs

### Database (High Priority)
- [ ] **Create `results` table** - Store quiz submissions
  ```sql
  CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id STRING NOT NULL,
    quiz_id STRING NOT NULL,
    date DATE NOT NULL,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    answers JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, quiz_id)
  );
  ```

- [ ] **Create `users` table** - Store user stats
  ```sql
  CREATE TABLE users (
    id STRING PRIMARY KEY,
    display_name STRING,
    streak INT DEFAULT 0,
    best_score INT DEFAULT 0,
    total_quizzes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_played DATE
  );
  ```

### Backend (High Priority)
- [ ] **Persist results** - Update `submitQuiz` to write to results table
- [ ] **Calculate streak** - Query results table for consecutive days
- [ ] **Update best score** - Compare and update user's best score
- [ ] **Implement leaderboard** - Aggregate scores from results table
- [ ] **Implement user stats** - Query results for user's history

### Backend (Medium Priority)
- [ ] **Duplicate submission prevention** - Check if user already submitted for quiz
- [ ] **London timezone** - Use Europe/London for quiz date calculation
- [ ] **Server-side auth validation** - Validate Auth0 tokens if needed

### Frontend (Low Priority)
- [ ] **Error boundaries** - Add React error boundaries for crash resilience
- [ ] **Offline answer queue** - Store answers locally if offline, submit on reconnect
- [ ] **Pull-to-refresh** - Add refresh gesture on leaderboard

### Future Considerations
- [ ] Analytics integration (if needed)
- [ ] Push notifications (currently out of scope)
- [ ] Quiz archives (currently out of scope)

---

## Known Limitations

1. **Streak calculation is placeholder** - Returns 1 always, needs results table
2. **Best score is placeholder** - Returns current score, needs persistence
3. **Leaderboard is hardcoded** - Returns fake data, needs results aggregation
4. **No duplicate prevention** - User could theoretically submit multiple times
5. **UTC timezone** - Quiz date uses UTC, not London time

---

## File Reference

| Concern | File Location |
|---------|---------------|
| Database schema | `data-contracts.md` |
| API endpoints | `api-plan.md` |
| Frontend structure | `frontend-plan.md` |
| Implementation status | `execution-plan.md` |
| Project overview | `README.md` |

---

## 📋 Maintenance Rules

**When completing a TODO:**
1. Mark the item with `[x]` in this file
2. Move it to a "Completed" section if creating one
3. Update related files (`execution-plan.md`, `scope.md`)
4. Update the "Last Updated" date in `README.md`

**When adding a new TODO:**
1. Add to the appropriate priority section
2. Include a brief description of what needs to be done
3. Reference related files/functions if applicable

**When discovering a new limitation:**
1. Add to the "Known Limitations" section
2. Consider adding a corresponding TODO if it should be fixed

