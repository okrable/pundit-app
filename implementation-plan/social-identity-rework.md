# Social Identity Rework

## Canonical identity

- Auth0 `sub` remains the private ownership key.
- `users.username` is the canonical public player identity.
- Authenticated user-row creation belongs to protected identity synchronization.
- `onboarding_status = 'username_required'` blocks protected player activity until a username is set.
- Existing accounts without usernames receive a deterministic username derived from their verified Auth0 email prefix.

## Delivery sequence

1. Identity foundation: additive schema, verified identity synchronization, legacy backfill, and quiz persistence ownership. **Merged in PR #12.**
2. Social backend alignment: reusable mutual friendship invites and server-resolved usernames in leaderboards and challenges. **In implementation.**
3. Client activation: blocking signup onboarding and username-only UI, released as v2.0.0.

The first two phases preserve legacy response fields for installed-client compatibility. Physical display-name cleanup waits until supported-client usage no longer includes a pre-v2.0.0 app for 30 consecutive days.

Friendship removal deletes the single ordered mutual row and is idempotent. A
retry reports success when an earlier slow request already completed, preventing
stale clients from becoming stuck after a timeout.

## Runtime gate

Run `db/audits/identity_onboarding_pre.sql` immediately before migration 012,
then run `db/audits/identity_onboarding.sql` after it. The migration is additive
and must be applied before preview Functions exercise the new identity contract.

Before phase 2 preview testing, run `db/audits/social_backend_pre.sql`, apply
migration 013, then run `db/audits/social_backend.sql`. Existing friend links
remain single-use; only links created after migration 013 are reusable.
