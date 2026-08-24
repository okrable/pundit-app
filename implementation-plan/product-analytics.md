# Product Analytics Baseline

## Purpose

Version 2.10 establishes first-party operational product telemetry before the
Daily Quiz navigation and pacing change. It is not advertising attribution and
it never joins the installation identifier to Auth0 identity. At the current
single-digit player count, D1/D7 percentages are descriptive only and must not
gate Release 1.

## Event Contract

- `app_shell_ready` measures first usable cached presentation, while `app_ready`
  remains the full restoration/reconciliation milestone used by the Release 0
  comparison. Guests normally emit both together.
- `today_viewed`, `quiz_start_requested`, and `quiz_first_question_ready`
  measure discovery and gameplay readiness.
- `quiz_started`, `quiz_question_answered`, `quiz_abandoned`, and
  `quiz_completed` measure the ranked funnel.
- `quiz_attempt_resumed` measures persisted-attempt recovery and Continue usage;
  ordinary refresh, backgrounding, and navigation no longer count as abandonment.
- `quiz_recap_viewed` and `quiz_shared` measure the result loop.
- `journey_started` measures bonus-game discovery.
- Archive event names are reserved for the later archive release.
- Existing auth/onboarding and retired Challenge names remain accepted for
  installed-client compatibility.
- `leaderboard_viewed` and `leaderboard_filter_changed` measure Daily/Weekly and
  Global/Friends-only use through fixed enum columns added by migration 019.
- `player_profile_viewed`, `friend_request_sent`, and
  `friend_request_accepted` measure the social funnel without player IDs or new
  properties.

Properties are fixed typed columns. No event accepts arbitrary metadata,
question text, selected answers, usernames, email addresses, Auth0 subjects, or
invite codes.

## Production Smoke Test

1. Apply migration 018 before publishing the client.
2. Confirm accepted v2.10 Production rows have `tracking_version = 1` and a
   non-null `analytics_id` using `db/audits/product_analytics.sql`.
3. Exercise guest, authenticated, logout/login, opt-out/reset, warm-cache,
   completion, recap, share, and Journey paths on preview and Production.
4. Confirm event sequences and durations are plausible on web, iOS, and Android.
5. After the smoke test is stable, proceed to Release 1 without waiting for a
   fixed number of days. Keep `db/queries/analytics_baseline.sql` for future
   retention reporting once cohorts are large enough to be credible.

For v2.11 startup evaluation, the baseline query reports `app_shell_ready` and
`app_ready` p50/p75 by actor type, platform, and app version. The event is an
additive tracking-version 1 event and carries only the existing typed duration
and source fields.

For v2.12 attempt-integrity evaluation, the baseline query reports resume and
completion counts by platform and app version. No selected answer, question
content, account identifier, or new free-form property is collected.

For v2.13 leaderboard evaluation, apply migration 019 before exercising the
preview. The baseline query groups view and filter events by scope, period,
platform, and app version; tracking remains version 1.

The v2.13 social events remain tracking-version 1 and use no properties, so
they cannot identify the viewed or requested player.

## Privacy and Retention

- Analytics is enabled by default to preserve the existing product-measurement
  behavior and can be disabled or reset from Settings.
- The random installation UUID survives sign-out but remains stored separately
  from account credentials and profile state.
- The scheduled retention Function deletes raw rows older than 90 days.
- Resetting the identifier separates future events from earlier device activity
  without changing the account, quiz cache, achievements, or debug log.
