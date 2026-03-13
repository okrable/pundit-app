# Pundit Trivia — Implementation Plan

> **Last Updated**: February 2026
> **Status**: Active product with Daily Quiz + Challenge Mode shipped
> **Source of Truth**: This folder is authoritative for planning and execution status.

## Purpose
This folder documents what is **actually shipped**, what is **currently being hardened**, and what is **next**. It is designed so new tasks inherit correct assumptions.

## Product Status Snapshot

### ✅ Delivered (Production features)
- Daily 5-question quiz flow (fetch, play, submit, results)
- Speed-based scoring (0–500 total)
- Daily leaderboard + personal stats
- Branded startup bootstrap with cached-first hydration
- Stale-first quiz/profile/leaderboard loading for warm opens
- Local-first result reveal with background sync/finalization
- Me profile page + settings modal
- Guest mode + optional Auth0 sign-in
- Server-side Auth0 ownership checks on protected endpoints (`token.sub === userId`)
- Configurable quiz-day timezone with London default (`Europe/London`)
- Challenge mode (create, join, play, reveal), including challenge history + W/L/D stats
- Friend links, friend list, and friends leaderboard endpoints/UI

### 🚧 In Progress / Hardening
- React error boundaries + crash-recovery UX
- Offline answer queue for retry-on-reconnect
- Endpoint-level rate limiting / abuse protection
- API observability (structured logging + alerting)

### 📋 Planned (after hardening)
- Push notifications
- Quiz archives / historical play
- Analytics / telemetry

## Canonical Docs in This Folder
Read in this order:
1. `scope.md` — current boundaries, delivered behavior, non-goals
2. `execution-plan.md` — phase progress + next milestones
3. `api-plan.md` — endpoint contracts and auth rules
4. `data-contracts.md` — payloads and DB-facing shapes
5. `performance-bootstrap.md` — startup bootstrap, stale-first caches, and background refresh
6. `assumptions-and-todos.md` — active TODOs and known limitations
7. `features/` — feature-specific implementation notes

## Maintenance Rules (Strict)
- Any significant behavior change must update docs in this folder in the same PR.
- If two docs disagree, update them immediately; do not leave drift.
- Prefer concise, current-state documentation over historical commentary.
- Archive or delete docs that only describe superseded plans.
