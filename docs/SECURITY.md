# Security Checklist — OWASP Top 10 (2021)

> Assessment of PersonalBudget against the [OWASP Top 10 (2021)](https://owasp.org/Top10/) web application security risks.
>
> **Last updated:** 2026-03-24
> **Automated audit:** `npx vitest run src/__tests__/security-audit.test.ts`

---

## Summary

| # | Category | Status | Notes |
|---|----------|:------:|-------|
| A01 | Broken Access Control | ✅ Pass | requireAuth + household_id scoping on all routes |
| A02 | Cryptographic Failures | ✅ Pass | bcrypt + pepper, HTTPS enforced via HSTS |
| A03 | Injection | ✅ Pass | Drizzle parameterized queries, Zod validation |
| A04 | Insecure Design | ✅ Pass | Household isolation by design |
| A05 | Security Misconfiguration | ✅ Pass | CSP, HSTS, 6 security headers configured |
| A06 | Vulnerable & Outdated Components | ⚠️ Monitor | Requires periodic `npm audit` checks |
| A07 | Identification & Authentication Failures | ✅ Pass | Rate limiting, bcrypt, OAuth providers |
| A08 | Software & Data Integrity Failures | ✅ Pass | Zod validation on all inputs |
| A09 | Security Logging & Monitoring Failures | ⚠️ Partial | Console logging only — no centralized log aggregation |
| A10 | Server-Side Request Forgery (SSRF) | ✅ Pass | No server-side URL fetching |

---

## Detailed Assessment

### A01: Broken Access Control

**Risk:** Users acting outside their intended permissions — accessing other users' data, elevating privileges, or bypassing access controls.

**Status: ✅ Pass**

**How it's addressed:**
- **Authentication:** 80 of 83 API routes call `requireAuth()` which validates the session and returns the user's `householdId`. The 3 public routes (`health`, `auth/register`, `auth/[...nextauth]`) are intentionally unauthenticated.
- **Tenant Isolation:** Every database query includes `eq(table.household_id, householdId)`. The automated audit test (`security-audit.test.ts`) verifies this for all route files and fails CI if a new route omits household scoping.
- **No Privilege Escalation:** There is no admin role — all household members have equal access within their household. Cross-household access is impossible by design.
- **Invite Decline Exception:** `household/invite/decline/route.ts` scopes by `user.email` rather than `household_id` because the declining user may not yet belong to the target household. This is documented and audited.

**Verification:** `npx vitest run src/__tests__/security-audit.test.ts` — auth middleware and household scoping audits

---

### A02: Cryptographic Failures

**Risk:** Exposure of sensitive data due to weak or missing cryptographic protections — cleartext passwords, weak hashing, missing HTTPS.

**Status: ✅ Pass**

**How it's addressed:**
- **Password Hashing:** bcrypt with a server-side pepper (`PEPPER_SECRET` env var). bcrypt provides adaptive cost factor and per-password salting.
- **HTTPS:** HSTS header (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`) enforces HTTPS on all connections.
- **Session Tokens:** Auth.js manages session token signing using `AUTH_SECRET` (minimum 32 bytes of entropy).
- **No Password Exposure:** `GET /api/household/members` explicitly selects safe columns only — password hashes are never returned in API responses.

**Caveats:**
- The pepper is stored as an environment variable. If the hosting platform's env var storage is compromised, the pepper is exposed. This is an accepted risk for the deployment model (Vercel encrypted env vars).

---

### A03: Injection

**Risk:** User-supplied data sent to an interpreter as part of a command or query — SQL injection, XSS, command injection.

**Status: ✅ Pass**

**How it's addressed:**
- **SQL Injection:** All database queries use Drizzle ORM's parameterized query builder. Raw SQL uses Drizzle's `sql` tagged template literal which auto-parameterizes values. The budget variance route's complex CTE query (9 household_id references) is fully parameterized. The automated audit verifies zero string concatenation in SQL.
- **XSS Prevention:** Zero `dangerouslySetInnerHTML` in the entire codebase (verified by automated audit). React's JSX auto-escaping handles all output rendering. CSP header restricts script sources to `'self'`.
- **Input Validation:** All mutation routes validate request bodies with Zod schemas before processing. Archive/toggle routes validate URL `[id]` parameters with `parseInt()`.

**Verification:** `npx vitest run src/__tests__/security-audit.test.ts` — XSS and SQL injection audits

---

### A04: Insecure Design

**Risk:** Missing or ineffective control design — flawed threat modeling, missing security requirements.

**Status: ✅ Pass**

**How it's addressed:**
- **Household Isolation:** The data model isolates all data by `household_id`. This is enforced at the query level (every `SELECT`, `INSERT`, `UPDATE`, `DELETE` includes `household_id`) and verified by automated audit.
- **Compound Unique Constraints:** Unique constraints on `app_settings(key)`, `categories(ref_number)`, and `recurring_dismissed_suggestions(fingerprint)` are compound with `household_id` — two households can have the same setting key or category reference number without conflict.
- **Error Message Redaction:** The register route returns generic error messages ("Registration failed") to prevent user enumeration attacks.
- **Rate Limiting by Design:** Auth endpoints are rate-limited to prevent brute force attacks.

---

### A05: Security Misconfiguration

**Risk:** Missing security hardening, unnecessary features enabled, default accounts, overly permissive configurations.

**Status: ✅ Pass**

**How it's addressed:**

Six security headers are configured on all responses via `next.config.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ...` | Prevents XSS by restricting resource origins |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year |
| X-Frame-Options | `DENY` | Prevents clickjacking |
| X-Content-Type-Options | `nosniff` | Prevents MIME-type sniffing |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limits referrer information leakage |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | Disables unused browser APIs |

**Caveats:**
- CSP `style-src` includes `'unsafe-inline'` because Ant Design uses CSS-in-JS with runtime style injection. Nonce-based CSP is not practical with Ant Design's pattern.
- CSP `script-src` includes `'unsafe-inline'` for Next.js hydration scripts. This weakens XSS protection slightly but is required for the framework.

---

### A06: Vulnerable and Outdated Components

**Risk:** Using components with known vulnerabilities — outdated libraries, unpatched frameworks.

**Status: ⚠️ Monitor**

**How it's addressed:**
- **Dependency Auditing:** Run `npm audit` periodically to check for known vulnerabilities.
- **Lock File:** `package-lock.json` pins exact dependency versions for reproducible builds.
- **Minimal Dependencies:** The app uses well-maintained libraries (Next.js, Drizzle ORM, Auth.js, Ant Design, Zod).

**Action Required:**
- Run `npm audit` before each deployment.
- Set up Dependabot or Renovate for automated dependency update PRs.
- Review `npm audit` output in CI pipeline.

---

### A07: Identification and Authentication Failures

**Risk:** Weak authentication mechanisms — credential stuffing, brute force, missing MFA, session fixation.

**Status: ✅ Pass**

**How it's addressed:**
- **Password Security:** bcrypt with server-side pepper. Email is lowercased before storage to prevent duplicate accounts.
- **Rate Limiting:** Registration endpoint: 5 requests per 60 seconds per IP. Login endpoint: 10 requests per 60 seconds per IP. Exceeding returns `429 Too Many Requests` with `Retry-After` header.
- **OAuth Providers:** Google and Microsoft OAuth provide strong authentication without password management.
- **Session Management:** Auth.js handles session token lifecycle, rotation, and expiry.

**Caveats:**
- In-memory rate limiter resets on Vercel serverless cold starts (~5-15 min idle). For production-grade rate limiting, use `@upstash/ratelimit` with Redis or Vercel WAF.
- No MFA is implemented. For a 2-user household budget app, this is acceptable. Add TOTP/WebAuthn if the user base grows.

---

### A08: Software and Data Integrity Failures

**Risk:** Code and infrastructure without integrity verification — insecure CI/CD pipelines, unsigned updates, untrusted data deserialization.

**Status: ✅ Pass**

**How it's addressed:**
- **Input Validation:** All API mutation routes validate request bodies with Zod schemas before processing. This ensures only expected data shapes reach the database.
- **Type Safety:** TypeScript with strict mode across the entire codebase. Drizzle ORM provides type-safe query building that matches the database schema.
- **Build Integrity:** `npm run build` must pass before deployment. The build step catches type errors and import issues.

---

### A09: Security Logging and Monitoring Failures

**Risk:** Insufficient logging, monitoring, and alerting — attacks go undetected, no audit trail.

**Status: ⚠️ Partial**

**How it's addressed:**
- **Rate Limit Logging:** The rate limiter logs `[rate-limit] IP exceeded threshold: <ip>` to `console.warn` on every 429 response. This is visible in Vercel's Function Logs.
- **Error Logging:** API routes log errors to `console.error` with context.
- **Health Check:** `GET /api/health` provides an unauthenticated health probe for uptime monitoring.

**Gaps:**
- No centralized log aggregation (Datadog, Sentry, etc.).
- No structured logging format (JSON logs would enable better querying).
- No audit trail for sensitive operations (member removal, settings changes).
- No alerting on authentication failures or unusual patterns.

**Recommendations:**
1. Add Sentry for error tracking and alerting.
2. Add structured JSON logging with a correlation ID per request.
3. Add an audit log table for sensitive operations.
4. Set up Vercel Log Drain to forward logs to a log aggregation service.

---

### A10: Server-Side Request Forgery (SSRF)

**Risk:** Web application fetches a remote resource without validating the user-supplied URL — allows attackers to scan internal networks or access cloud metadata.

**Status: ✅ Pass**

**How it's addressed:**
- The application does **not** make any server-side HTTP requests based on user input.
- No `fetch()` calls in API routes use user-supplied URLs.
- PostHog analytics are proxied through a fixed middleware path (`/ingest`) to a hardcoded host — not user-configurable at runtime.
- File imports (OFX/CSV) are parsed locally from uploaded file content — no URL fetching.

---

## Automated Security Audit

The test suite at `src/__tests__/security-audit.test.ts` automatically verifies:

1. **Auth Middleware Coverage:** Every API route imports `requireAuth` (3 known public exceptions)
2. **Household Scoping:** Every data query includes `household_id` (1 documented exception)
3. **XSS Prevention:** Zero `dangerouslySetInnerHTML` in source files
4. **SQL Injection Prevention:** No string-concatenated SQL, all raw SQL uses parameterized `sql` template
5. **Security Headers:** CSP, HSTS, and other headers configured in `next.config.ts`

Run the audit:
```bash
npx vitest run src/__tests__/security-audit.test.ts
```

This test runs in CI and catches security regressions automatically. Adding a new route without `requireAuth` or `household_id` scoping will fail the build.
