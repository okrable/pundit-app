# Agent Instructions

These instructions are for coding agents working in this repository.

## Project Basics

- This is an Expo React Native app using TypeScript, React Navigation, Zustand, Netlify Functions, CockroachDB, Auth0, and Reanimated.
- Use Node `20.19.4` for local commands.
- Prefer existing app patterns, stores, services, theme values, and component structure over introducing new abstractions.
- Keep changes scoped to the requested behavior. Do not refactor unrelated files while fixing or adding a feature.

## Required Validation

- Run `npx tsc --noEmit` before handoff unless the task is docs-only and clearly cannot affect TypeScript.
- For gameplay, auth, cache, or profile changes, manually reason through guest, authenticated, logout/login, and warm-cache paths.
- For UI changes, check small and large mobile layouts conceptually and avoid text overlap, wasted space, or hidden controls.

## Versioning

- Maintain app versioning with SemVer.
- Keep these files aligned whenever the app version changes:
  - `package.json`
  - `package-lock.json`
  - `app.json`
  - `app/constants/version.ts`
  - `CHANGELOG.md`
- Do not bump the version at the start of a task. Make the change first, then classify the completed work:
  - Patch: bug fixes, copy tweaks, narrow polish, no meaningful product behavior change.
  - Minor: user-visible features or meaningful UX/product improvements.
  - Major: breaking product, scoring, storage, auth, or compatibility changes.
- Settings must display the current app version from `APP_VERSION`; do not hard-code version text in UI components.
- Add a concise `CHANGELOG.md` entry for every version bump, with the newest version at the top.

## Documentation

- `README.md` is the human-facing project overview.
- `implementation-plan/` is the current implementation source of truth.
- `CHANGELOG.md` is the release history.
- Update relevant docs in the same change as meaningful behavior changes.
- Prefer current-state documentation over stale plans or long historical notes.

## Daily Quiz Rules

- Preserve the typewriter prompt effect; it is intentional.
- The timer must start only after the full prompt and answer options are visible.
- Do not reintroduce timeout/unanswered-question auto-fail behavior.
- At timer zero, the player can still answer; a correct post-zero answer receives the minimum score.
- Guest daily plays should remain local-only until login migration/adoption.
- The immediate post-quiz summary is for the current completed play; returning later should use the completed cached state.
- Keep daily quiz and challenge mode aligned on the shared refreshed `QuestionCard` gameplay surface.

## Auth and Identity

- Do not add screen-level Auth0 authorization-code exchange handlers.
- Login/logout orchestration belongs in `app/services/authFlow.ts`.
- Login should keep reconciliation and first data prefetch behind `AuthSyncScreen`.
- Guest-to-auth reconciliation must prevent stale in-progress guest quiz UI from flashing.
- Logout currently clears local app credentials without invoking hosted Auth0 browser logout. Do not change this unless explicitly requested.
- Protected API calls must preserve bearer-token ownership assumptions: authenticated `userId` must match Auth0 `sub`.

## Settings and Profile

- Authenticated users should not see guest-only settings such as clearing the guest quiz cache.
- The username prompt should only appear when the authenticated profile explicitly requires it.
- Keep debug-log copy/clear controls available from Settings.

## Safety

- Do not revert unrelated work in a dirty tree.
- Do not delete caches, generated folders, or native build artifacts unless the task explicitly requires it.
- Avoid broad filesystem searches outside the repository; keep exploration scoped to the project.
