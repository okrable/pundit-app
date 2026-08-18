# Feature: Local-First Achievements

> Status: Implemented in v2.9.0

Pundit evaluates Debut, Sharpshooter, Top Bins, Dedication, Veteran, Stoppage
Time, Comeback King, and Fashion Show through the shared achievement evaluator.
Daily results and avatar changes update a versioned account-scoped local snapshot
before or alongside their existing network flow. The associated protected
request validates the same event, persists authenticated progress, and returns
the canonical snapshot; there are no achievement-only API endpoints.

Daily Quiz unlocks are queued until the immediate or restored result surface.
Non-game unlocks appear after their triggering action succeeds. One app-level
panel displays simultaneous unlocks as a reduced-motion-aware list.

Authenticated Me displays all eight achievements. Visible milestones expose
progress while locked easter eggs retain mystery copy. Guests can earn the five
single-play quiz achievements locally; only the current adopted guest result is
validated at login, while cumulative progress starts after authentication.

Achievement tracking starts at v2.9.0. Migration 017 is additive and intentionally
does not backfill older results, streaks, or avatar changes.
