# Social Identity Rework

## Canonical identity

- Auth0 `sub` remains the private ownership key.
- `users.username` is the canonical public player identity.
- Authenticated user-row creation belongs to protected identity synchronization.
- `onboarding_status = 'username_required'` blocks protected player activity until a username is set.
- Existing accounts without usernames receive a deterministic username derived from their verified Auth0 email prefix.

## Delivery sequence

1. Identity foundation: additive schema, verified identity synchronization,
   legacy backfill, and quiz persistence ownership. **Merged in PR #12;
   migration 012 applied and audited.**
2. Social backend alignment: reusable mutual friendship invites, ordered mutual
   relationships, username-only persisted rankings, server-resolved challenge
   identities, focus refresh, and retry-safe removal. **Implemented in PR #13
   and ready for review; migration 013 applied and audited.**
3. Client activation: blocking signup onboarding, username-only public UI, and
   social cache-version upgrades. **Planned as the v2.0.0 release.**

The first two phases preserve legacy response fields for installed-client compatibility. Physical display-name cleanup waits until supported-client usage no longer includes a pre-v2.0.0 app for 30 consecutive days.

Friendship removal deletes the single ordered mutual row and is idempotent. A
retry reports success when an earlier slow request already completed, preventing
stale clients from becoming stuck after a timeout.

## Runtime migration status

Migrations 012 and 013 were applied to production CockroachDB on 25 July 2026.
Their aggregate pre/post audit queries completed successfully.

For a new environment, run migrations in order and use:

- `db/audits/identity_onboarding_pre.sql` before migration 012 and
  `db/audits/identity_onboarding.sql` after it;
- `db/audits/social_backend_pre.sql` before migration 013 and
  `db/audits/social_backend.sql` after it.

Both migrations are additive. Existing friend links remain single-use; only
links created after migration 013 are reusable.

## Verified phase-2 behavior

- Reopening Invite Friends reuses the same active seven-day code.
- Different signed-in players can accept the same code.
- Acceptance creates one ordered friendship row and repeat acceptance succeeds.
- Both players see the relationship; League Tables forces a refresh on focus.
- Removal updates the list and leaderboard, deletes the one mutual row, and is
  safe to retry after a slow response.
- Persisted leaderboards include only completed authenticated username
  identities.
- Challenge create/join/read/history resolve current usernames through `users`;
  legacy guest activity keeps an explicit legacy label.
- Deprecated display-name response fields contain usernames for old-client
  compatibility.
