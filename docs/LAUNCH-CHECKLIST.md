# Launch Readiness Checklist

> Pre-launch verification for PersonalBudget. Complete all items before production deployment.
>
> **Last updated:** 2026-03-24

---

## Deployment

- [ ] `npm run build` exits 0 with no TypeScript errors
- [ ] Environment variables set in production (see `docs/ENV.md` for full list)
- [ ] `DATABASE_URL` points to production PostgreSQL (Neon/Supabase)
- [ ] `AUTH_SECRET` is a unique 32+ character random string (not shared with dev)
- [ ] `AUTH_TRUST_HOST=true` is set for reverse proxy (Vercel)
- [ ] `PEPPER_SECRET` is set and backed up securely (losing it locks out password users)
- [ ] OAuth redirect URIs updated to production domain in Google Cloud Console and Azure Portal
- [ ] Database migrations applied: `npx drizzle-kit push` or migration SQL executed
- [ ] Health check endpoint responds: `curl -s https://your-domain.com/api/health | jq .status`

## Security

- [ ] Security headers verified: `curl -I https://your-domain.com` shows CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [ ] HSTS preload submitted (optional): [hstspreload.org](https://hstspreload.org)
- [ ] Rate limiting active on auth endpoints (test with rapid requests → expect 429)
- [ ] `npm audit` shows no critical or high vulnerabilities
- [ ] Security audit tests pass: `npx vitest run src/__tests__/security-audit.test.ts`
- [ ] OWASP Top 10 checklist reviewed: see `docs/SECURITY.md`
- [ ] No sensitive data in source control: `.env.local` is in `.gitignore`
- [ ] Password pepper (`PEPPER_SECRET`) stored separately from database credentials

## Monitoring

- [ ] Uptime monitoring configured to poll `GET /api/health` (e.g., UptimeRobot, BetterUptime)
- [ ] Error tracking service connected (Sentry, LogRocket, or Vercel Error Tracking)
- [ ] Vercel deployment notifications enabled (Slack/email on deploy success/failure)
- [ ] PostHog analytics configured and receiving events (check PostHog dashboard)
- [ ] Log drain configured for production function logs (optional but recommended)

## Data

- [ ] Production database is on a paid plan with automatic backups enabled
- [ ] Point-in-time recovery (PITR) configured for the database
- [ ] Database connection pooling enabled (Neon: use pooled connection string; Supabase: use pgBouncer URL)
- [ ] Test household created and basic workflow verified (create account → add transaction → view budget)
- [ ] Compound unique constraints applied: `app_settings(key, household_id)`, `categories(ref_number, household_id)`, `recurring_dismissed_suggestions(fingerprint, household_id)`

## Performance

- [ ] Vercel region selected closest to users (e.g., `iad1` for US East)
- [ ] Next.js image optimization configured (if using images)
- [ ] Bundle size reviewed: `npm run build` output shows reasonable page sizes
- [ ] Database indexes exist for frequently queried columns (household_id is indexed via foreign keys)
- [ ] No N+1 query patterns in API routes (verified during development)

## Documentation

- [ ] `docs/API.md` — API route reference is complete and accurate
- [ ] `docs/ENV.md` — Environment variable reference covers all variables
- [ ] `docs/SECURITY.md` — OWASP Top 10 assessment is current
- [ ] `docs/LAUNCH-CHECKLIST.md` — This checklist is complete
- [ ] `README.md` — Project README has setup instructions
- [ ] `.env.example` — Template has all required variables with comments

---

## Post-Launch

After launching, set up ongoing maintenance:

- [ ] Enable Dependabot or Renovate for automated dependency updates
- [ ] Schedule monthly `npm audit` reviews
- [ ] Review Vercel function logs weekly for errors or rate limit events
- [ ] Plan for centralized logging (Datadog, Axiom, or similar) if usage grows
- [ ] Consider upgrading rate limiting to `@upstash/ratelimit` with Redis if abuse is detected
- [ ] Monitor PostHog for user behavior insights and feature flag usage
