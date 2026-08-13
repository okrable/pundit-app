# Assumptions and TODOs

## Confirmed Assumptions

- UK daily quiz and career data is sourced from BigQuery from the configured
  cutover date; legacy and non-UK quiz data remains in `pu_player_ques`.
- Approved BigQuery rows are immutable once their quiz date is live.
- Quiz-day logic must stay aligned between backend `QUIZ_TIMEZONE` and frontend `EXPO_PUBLIC_QUIZ_TIMEZONE`.
- Protected endpoints require Auth0 bearer-token ownership checks.
- Guest play remains supported, but guest daily results are local-only until login migration/adoption.
- The typewriter prompt effect is intentional gameplay identity.
- The timer must not start before the prompt and options are visible.
- Local logout should avoid hosted Auth0 browser logout because it triggers unwanted iOS sign-in UI.
- App SemVer is canonical across `package.json`, `package-lock.json`,
  `app.json`, `app/constants/version.ts`, native marketing versions, and
  Settings.
- `main` is the only permanent and production-significant branch; all other branches receive identical preview behavior.
- Web and iOS changes are validated from the same source commit.
- Preview builds use designated test accounts against the configured production CockroachDB/Auth0 services.
- Challenge remains retired across new and installed clients; its implementation
  and historical data are preserved without active mutations.

## Active TODOs

### High Priority

- [x] Add React error boundary coverage around the app navigation root.
- [x] Extend persistent retry to challenge submissions.
- [x] Add pull-request CI and shared behavior tests.
- [x] Add verified identity synchronization and canonical social username guards.
- [x] Align mutual friendships, leaderboards, and challenges on server-resolved usernames.
- [x] Complete blocking username onboarding and username-only client activation for v2.0.0.
- [x] Bump profile and leaderboard cache schemas without invalidating gameplay state.

### Medium Priority

- [x] Add endpoint-level rate limiting and abuse protection.
- [ ] Configure API alerting and error-budget reporting.
- [ ] Add integration coverage for authenticated API and cache flows.

### Low Priority

- [x] Add anonymous aggregate analytics for key funnel events.
- [ ] Add production release tags so changelog milestones can be dated authoritatively.

## Known Limitations

1. Daily quiz and Journey submissions retry, but the app is not a fully offline product.
2. Error boundary coverage exists at the app root; finer per-screen recovery can still be added later if needed.
3. Rate-limit rows require routine expiry cleanup as traffic grows.
4. Release history before v1.1.0 is milestone-based rather than tag/date-based.
5. Display-name columns and response aliases remain until v2 is distributable
   natively and supported-client analytics show no pre-v2.0.0 use for 30
   consecutive days.

## Documentation Discipline

- Update this file and `execution-plan.md` whenever TODO status changes.
- Update `CHANGELOG.md` and version constants for release changes.
- Remove TODOs that are no longer actionable.
