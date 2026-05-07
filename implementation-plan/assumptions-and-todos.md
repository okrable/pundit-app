# Assumptions and TODOs

## Confirmed Assumptions

- Daily quiz data is sourced from CockroachDB table `pu_player_ques`.
- Quiz-day logic must stay aligned between backend `QUIZ_TIMEZONE` and frontend `EXPO_PUBLIC_QUIZ_TIMEZONE`.
- Protected endpoints require Auth0 bearer-token ownership checks.
- Guest play remains supported, but guest daily results are local-only until login migration/adoption.
- The typewriter prompt effect is intentional gameplay identity.
- The timer must not start before the prompt and options are visible.
- Local logout should avoid hosted Auth0 browser logout because it triggers unwanted iOS sign-in UI.
- App SemVer is canonical across `package.json`, `app.json`, `app/constants/version.ts`, and Settings.

## Active TODOs

### High Priority

- [ ] Add React error boundaries around core navigation/screen roots.
- [ ] Add offline answer queue and background retry.

### Medium Priority

- [ ] Add endpoint-level rate limiting and abuse protection on quiz/challenge submit paths.
- [ ] Improve API observability and alerting.

### Low Priority

- [ ] Add pull-to-refresh parity across leaderboard/challenge views where missing.
- [ ] Add lightweight analytics for key funnel events.
- [ ] Add production release tags so changelog milestones can be dated authoritatively.

## Known Limitations

1. Fully offline play is partial until an answer queue exists.
2. Error boundary coverage is incomplete.
3. Rate limiting/throttling coverage is not comprehensive.
4. Release history before v1.1.0 is milestone-based rather than tag/date-based.

## Documentation Discipline

- Update this file and `execution-plan.md` whenever TODO status changes.
- Update `CHANGELOG.md` and version constants for release changes.
- Remove TODOs that are no longer actionable.
