# Environment Variables Reference

> All environment variables for PersonalBudget. Copy `.env.example` to `.env.local` and fill in the values.

---

## Quick Setup

```bash
cp .env.example .env.local
# Then fill in each value below
```

---

## Database

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string for Drizzle ORM. Supports Neon, Supabase, or local Docker PostgreSQL. |

**Format:** `postgresql://user:password@host:5432/personalbudget`

**Where to get it:**
- **Neon:** [neon.tech](https://neon.tech) → Create project → Connection string (use the pooled connection string for serverless)
- **Supabase:** [supabase.com](https://supabase.com) → Project Settings → Database → Connection string
- **Local Docker:** `postgresql://postgres:postgres@localhost:5432/personalbudget`

---

## Authentication (NextAuth.js / Auth.js)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `AUTH_SECRET` | ✓ | Random secret used to sign and encrypt session tokens. Must be at least 32 characters. |
| `AUTH_TRUST_HOST` | ✓ | Set to `true` when running behind a reverse proxy (Vercel, Nginx, Cloudflare). Required for production. |
| `AUTH_DEBUG` | ✗ | Set to `true` for verbose auth logging. **Development only** — do not enable in production. |

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

**Example:** `AUTH_TRUST_HOST=true`

---

## OAuth: Google

| Variable | Required | Description |
|----------|:--------:|-------------|
| `GOOGLE_CLIENT_ID` | ✓ | OAuth 2.0 Client ID for Google Sign-In. |
| `GOOGLE_CLIENT_SECRET` | ✓ | OAuth 2.0 Client Secret for Google Sign-In. |

**Where to get it:**
1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
4. For local dev: `http://localhost:3000/api/auth/callback/google`

**Format:** `GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com`

---

## OAuth: Microsoft

| Variable | Required | Description |
|----------|:--------:|-------------|
| `MICROSOFT_CLIENT_ID` | ✓ | Application (client) ID from Azure AD app registration. |
| `MICROSOFT_CLIENT_SECRET` | ✓ | Client secret value from Azure AD app registration. |

**Where to get it:**
1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Register a new application (Web platform)
3. Add redirect URI: `https://your-domain.com/api/auth/callback/microsoft-entra-id`
4. For local dev: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Create a client secret under Certificates & secrets

**Format:** `MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## Security

| Variable | Required | Description |
|----------|:--------:|-------------|
| `PEPPER_SECRET` | ✓ | Server-side pepper for password hashing. Combined with bcrypt salt for defense-in-depth. **Never change after users have registered** — existing passwords will become unverifiable. |

**Generate PEPPER_SECRET:**
```bash
openssl rand -base64 32
```

> ⚠️ **Critical:** If you lose or change this value, all existing credential-based (email+password) users will be locked out. OAuth users are unaffected.

---

## PostHog Analytics & Feature Flags

| Variable | Required | Description |
|----------|:--------:|-------------|
| `NEXT_PUBLIC_POSTHOG_KEY` | ✗ | PostHog project API key. This is a **public key** (safe to expose in the browser). Analytics are disabled if not set. |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✗ | PostHog API host. Defaults to `https://us.i.posthog.com`. Change only if self-hosting PostHog. The app proxies events through `/ingest` to avoid ad-blockers. |

**Where to get it:**
1. Go to [PostHog](https://posthog.com) → Project Settings → Project API Key
2. Copy the key (starts with `phc_`)

**Format:** `NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key`

---

## Summary Table

| Variable | Required | Category | Sensitive |
|----------|:--------:|----------|:---------:|
| `DATABASE_URL` | ✓ | Database | ✓ |
| `AUTH_SECRET` | ✓ | Authentication | ✓ |
| `AUTH_TRUST_HOST` | ✓ | Authentication | ✗ |
| `AUTH_DEBUG` | ✗ | Authentication | ✗ |
| `GOOGLE_CLIENT_ID` | ✓ | OAuth | ✗ |
| `GOOGLE_CLIENT_SECRET` | ✓ | OAuth | ✓ |
| `MICROSOFT_CLIENT_ID` | ✓ | OAuth | ✗ |
| `MICROSOFT_CLIENT_SECRET` | ✓ | OAuth | ✓ |
| `PEPPER_SECRET` | ✓ | Security | ✓ |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✗ | Analytics | ✗ |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✗ | Analytics | ✗ |

> **Sensitive variables** should never be committed to source control or logged. Use your hosting platform's secret management (Vercel Environment Variables, Doppler, etc.).
