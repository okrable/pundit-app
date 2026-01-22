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
| Leaderboard scope? | Global daily leaderboard (all Auth0 users for today) |
| Historical results retention? | ✅ Implemented - `results` table stores all submissions |
| Guest vs Auth0 database interaction? | Guests have NO database interaction (incentivizes signup) |
| Streak calculation rules? | Consecutive days ending with today; 0 if today not completed |
| Auth0 attributes to store? | id, display_name (editable), email, avatar_url |

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

## Completed TODOs ✅

### Database
- [x] **Create `results` table** - `db/migrations/002_results.sql`
- [x] **Create `users` table** - `db/migrations/001_users.sql`

### Backend
- [x] **Persist results** - `submitQuiz` writes to results table for Auth0 users
- [x] **Calculate streak** - JavaScript-based consecutive day calculation
- [x] **Update best score** - Compared and updated on each submission
- [x] **Implement leaderboard** - Daily aggregation from results table
- [x] **Implement user stats** - Query users table for real stats
- [x] **Duplicate submission prevention** - Idempotent via UNIQUE(user_id, quiz_id)

### Frontend
- [x] **"Me" profile page** - Replaced Settings tab, shows stats for logged-in users
- [x] **Settings modal** - Moved settings to modal accessed via cog icon
- [x] **Guest leaderboard prompt** - Banner encouraging signup
- [x] **Tap-and-hold speed-up** - Speeds up typewriter effect when holding

---

## Remaining TODOs

### Medium Priority
- [ ] **London timezone** - Use Europe/London for quiz date calculation
- [ ] **Error boundaries** - Add React error boundaries for crash resilience
- [ ] **Display name editing** - UI to let users edit their display name

### Low Priority
- [ ] **Server-side auth validation** - Validate Auth0 tokens if needed
- [ ] **Offline answer queue** - Store answers locally if offline, submit on reconnect
- [ ] **Pull-to-refresh** - Add refresh gesture on leaderboard

### Future Considerations
- [ ] Analytics integration (if needed)
- [ ] Push notifications (currently out of scope)
- [ ] Quiz archives (currently out of scope)
- [ ] Leagues feature (schema created: `db/migrations/003_leagues.sql`)
- [ ] Online games feature (schema created: `db/migrations/004_online_games.sql`)

---

## Known Limitations

1. ~~**Streak calculation is placeholder**~~ ✅ Fixed - Real streak from consecutive days
2. ~~**Best score is placeholder**~~ ✅ Fixed - Persisted in users table
3. ~~**Leaderboard is hardcoded**~~ ✅ Fixed - Real daily aggregation
4. ~~**No duplicate prevention**~~ ✅ Fixed - Idempotent via UNIQUE constraint
5. **UTC timezone** - Quiz date uses UTC, not London time (still pending)
6. **Guest data not persisted** - Intentional: guests have no DB interaction
7. **time_taken_seconds not tracked** - Field exists in results but not populated

---

## File Reference

| Concern | File Location |
|---------|---------------|
| Database schema | `data-contracts.md`, `db/migrations/` |
| API endpoints | `api-plan.md` |
| Frontend structure | `frontend-plan.md` |
| Implementation status | `execution-plan.md` |
| Project overview | `README.md` |
| Users + Results feature | `features/users-results-integration.md` |
| Me profile page feature | `features/me-profile-page.md` |

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

