# Assumptions and TODOs

## Assumptions consciously avoided
- No assumption of authentication or user accounts
- No assumption of existing schema or table names
- No assumption of existing API endpoints
- No assumption of analytics or notification services

## Open questions
- How are quizzes stored and scheduled in CockroachDB?
- Is there an existing backend or must Netlify Functions be created from scratch?
- What is the required user identity model (guest only, optional login)?
- How should leaderboards be scoped (global, league, daily/weekly)?
- What is the expected retention of historical results?

## Inputs required before build
- Data source details (schema, tables, or API definitions)
- Netlify Functions deployment details
- DB connection method and secrets management
- Final UX copy and branding
- Target devices for sizing to ensure no-scroll core screens

