## Summary

Describe the user-visible outcome and why the change is needed.

## Validation

- [ ] `npm test`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build:web`
- [ ] Netlify Deploy Preview is ready
- [ ] Required backward-compatible database migrations were applied before runtime validation
- [ ] Responsive web smoke test completed
- [ ] iOS smoke test completed, or the PR explains why it is not affected

## Cross-platform checks

- [ ] Guest and authenticated paths considered
- [ ] Login, logout/login, and warm-cache paths considered
- [ ] Small and large mobile layouts checked
- [ ] Friend/challenge links checked when relevant
- [ ] Daily quiz timing, typewriter, and post-zero behavior preserved when relevant

## Production smoke plan

List the checks to run immediately after merge.
