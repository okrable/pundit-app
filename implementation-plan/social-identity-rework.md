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
   identities, focus refresh, and retry-safe removal. **Merged in PR #13;
   migration 013 applied and audited.**
3. Client activation: blocking signup onboarding, username-only public UI, and
   selective social cache-version upgrades. **Delivered in v2.0.0.**

Legacy response fields remain for installed-client compatibility. Physical
display-name cleanup waits until v2 has a distributable native release and
supported-client usage no longer includes a pre-v2.0.0 app for 30 consecutive
days.

Friendship removal deletes the single ordered mutual row and is idempotent. A
retry reports success when an earlier slow request already completed, preventing
stale clients from becoming stuck after a timeout.

From v2.13.0, public leaderboard and Friends rows open a public accomplishment
profile. New in-app additions use a pending approval row per ordered player
pair; duplicate sends are idempotent and reciprocal sends accept atomically.
Invite links remain an explicit immediate-accept route and clear any pending
request between the pair.

## Runtime migration status

Migrations 012 and 013 were applied to production CockroachDB on 25 July 2026.
Their aggregate pre/post audit queries completed successfully.
Migration 020 was applied on 24 August 2026 before the expanded v2.13.0
authenticated preview; it adds only the pending-request table and indexes.

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

## Current client behavior

- Interactive login owns post-login activation. Bootstrap activates only
  sessions restored from storage, and activation is deduplicated by user and
  auth-state version.
- Every activation stage checks the current user, token, and auth-state version;
  late results after logout, token failure, or account switching are discarded.
- Signup, login, and restoration synchronize identity before reconciliation,
  protected prefetching, deep links, or navigation.
- `username_required` survives restart and presents a full-screen gate whose
  only escape is local sign-out.
- Only explicit `username_required` state renders onboarding. Transient work
  uses `AuthSyncScreen`, while genuine failures offer retry or sign-out.
- New signup flows require username selection. Legacy login/restore accounts
  without one receive a deterministic username.
- A username can be selected once. Same-value retries are idempotent; later
  changes are rejected, including for generated legacy usernames.
- Me, friends, leaderboards, avatars, and challenges render canonical usernames
  without consuming display-name aliases.
- Profile and leaderboard cache schema 2 invalidates old social payloads while
  quiz, result, guest, auth, and pending-submission storage remains intact.
