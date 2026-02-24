# Assumptions and TODOs

## Confirmed Assumptions (Current)
- Daily quiz data is sourced from CockroachDB table `pu_player_ques` via serverless functions.
- Quiz-day logic is timezone-aware and should remain aligned between backend (`QUIZ_TIMEZONE`) and client (`EXPO_PUBLIC_QUIZ_TIMEZONE`).
- Protected endpoints require bearer-token ownership checks for authenticated users.
- Guest play remains supported, with intentionally limited persistence for profile/social features.

## Active TODOs

### High Priority
- [ ] Add React error boundaries around core navigation/screen roots.
- [ ] Add offline answer queue and background retry.

### Medium Priority
- [ ] Add endpoint-level rate limiting / abuse protection on quiz/challenge submit paths.

### Low Priority
- [ ] Add pull-to-refresh parity across leaderboard/challenge views where missing.
- [ ] Add lightweight analytics for key funnel events (start quiz, submit quiz, challenge completion).

## Known Limitations
1. No offline answer queue yet; playing fully offline is partial only.
2. Error boundary coverage is incomplete.
3. Rate limiting/throttling coverage is not comprehensive.

## Documentation Discipline
- Update this file and `execution-plan.md` whenever a TODO is completed.
- Remove TODOs that are no longer actionable.
- Keep wording implementation-specific (avoid speculative planning notes).
