/**
 * Automated Security Audit Test Suite
 *
 * Source-code analysis tests (grep-based, no DB/network required) that verify
 * critical security properties for this multi-tenant household budget app.
 *
 * Audit categories:
 *   1. Auth middleware coverage — every API route uses requireAuth
 *   2. Household scoping — every authenticated route scopes queries to householdId
 *   3. XSS prevention — no dangerouslySetInnerHTML anywhere in src/
 *   4. SQL injection prevention — all raw SQL uses tagged template literals
 *   5. Security headers — CSP and HSTS configured in next.config.ts
 *
 * These tests run as part of `npm test` and catch security regressions permanently.
 * They use fs.readFileSync only — no database, no network, no mocking.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..')
const SRC_DIR = path.resolve(PROJECT_ROOT, 'src')
const API_DIR = path.resolve(SRC_DIR, 'app/api')

/**
 * Recursively find all files matching a name under a directory.
 */
function findFiles(dir: string, fileName: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, fileName))
    } else if (entry.name === fileName) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Recursively find all .ts/.tsx files under a directory.
 */
function findSourceFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules and .next build artifacts
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      results.push(...findSourceFiles(fullPath))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

/** Return path relative to project root for readable test output. */
function relativePath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
}

/** Read a file's content as UTF-8 string. */
function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

// ---------------------------------------------------------------------------
// Route file discovery
// ---------------------------------------------------------------------------

const routeFiles = findFiles(API_DIR, 'route.ts')

/**
 * Known public endpoints that intentionally do NOT import requireAuth.
 * Each entry is a normalized forward-slash suffix that matches the end of the route path.
 */
const KNOWN_PUBLIC_ROUTES = [
  'health/route.ts',
  'auth/register/route.ts',
  'auth/[...nextauth]/route.ts',
]

/**
 * Routes that use requireAuth but scope access via a mechanism other than
 * householdId (e.g. user email for invite operations). Each must have a
 * documented reason.
 */
const HOUSEHOLD_SCOPING_EXCEPTIONS: Record<string, string> = {
  // The decline endpoint queries by invite_id + user.email because the
  // declining user may not yet belong to the target household.
  'household/invite/decline/route.ts':
    'Scoped by user.email on invite record, not householdId — user may not belong to target household yet',
}

function isKnownPublicRoute(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return KNOWN_PUBLIC_ROUTES.some((suffix) => normalized.endsWith(suffix))
}

function isHouseholdScopingException(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return Object.keys(HOUSEHOLD_SCOPING_EXCEPTIONS).some((suffix) =>
    normalized.endsWith(suffix),
  )
}

/**
 * Check whether a file imports requireAuth (as an actual import statement,
 * not just a comment mention).
 */
function importsRequireAuth(content: string): boolean {
  // Match: import { requireAuth } from '...' or import { ..., requireAuth, ... } from '...'
  return /import\s+\{[^}]*\brequireAuth\b[^}]*\}\s+from\s+/.test(content)
}

// ===========================================================================
// 1. AUTH MIDDLEWARE COVERAGE
// ===========================================================================

describe('Auth middleware coverage', () => {
  it('discovers all API route files', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(80)
    // Exact count at time of writing: 83
    console.log(`[security-audit] Found ${routeFiles.length} API route files`)
  })

  it('has exactly 3 known public routes', () => {
    expect(KNOWN_PUBLIC_ROUTES).toHaveLength(3)
  })

  it('every API route imports requireAuth or is a known public endpoint', () => {
    const unprotectedRoutes: string[] = []

    for (const filePath of routeFiles) {
      if (isKnownPublicRoute(filePath)) continue

      const content = readFile(filePath)
      if (!importsRequireAuth(content)) {
        unprotectedRoutes.push(relativePath(filePath))
      }
    }

    expect(
      unprotectedRoutes,
      `These API routes do NOT import requireAuth and are NOT in the known-public list:\n${unprotectedRoutes.join('\n')}`,
    ).toEqual([])
  })

  it('all known public routes actually exist', () => {
    for (const suffix of KNOWN_PUBLIC_ROUTES) {
      const found = routeFiles.some((f) =>
        f.replace(/\\/g, '/').endsWith(suffix),
      )
      expect(found, `Expected public route to exist: ${suffix}`).toBe(true)
    }
  })

  it('known public routes do NOT import requireAuth', () => {
    for (const filePath of routeFiles) {
      if (!isKnownPublicRoute(filePath)) continue

      const content = readFile(filePath)
      expect(
        importsRequireAuth(content),
        `Public route ${relativePath(filePath)} should NOT import requireAuth`,
      ).toBe(false)
    }
  })
})

// ===========================================================================
// 2. HOUSEHOLD SCOPING (TENANT ISOLATION)
// ===========================================================================

describe('Household scoping — tenant isolation', () => {
  it('every authenticated route references householdId or household_id', () => {
    const unscopedRoutes: string[] = []

    for (const filePath of routeFiles) {
      // Skip public routes (no auth = no household context)
      if (isKnownPublicRoute(filePath)) continue
      // Skip documented exceptions
      if (isHouseholdScopingException(filePath)) continue

      const content = readFile(filePath)

      // Must have requireAuth (already enforced above, but defensive)
      if (!importsRequireAuth(content)) continue

      // Check for householdId (JS variable from requireAuth destructuring)
      // or household_id (SQL column name in template literals)
      const hasHouseholdScoping =
        /\bhouseholdId\b/.test(content) || /\bhousehold_id\b/.test(content)

      if (!hasHouseholdScoping) {
        unscopedRoutes.push(relativePath(filePath))
      }
    }

    expect(
      unscopedRoutes,
      `These authenticated routes do NOT reference householdId/household_id:\n${unscopedRoutes.join('\n')}`,
    ).toEqual([])
  })

  it('household scoping exceptions are documented with reasons', () => {
    for (const [route, reason] of Object.entries(
      HOUSEHOLD_SCOPING_EXCEPTIONS,
    )) {
      expect(reason.length).toBeGreaterThan(10)
      // Verify the exception file actually exists
      const found = routeFiles.some((f) =>
        f.replace(/\\/g, '/').endsWith(route),
      )
      expect(
        found,
        `Household scoping exception '${route}' does not match any route file — remove stale exception`,
      ).toBe(true)
    }
  })
})

// ===========================================================================
// 3. XSS PREVENTION
// ===========================================================================

describe('XSS prevention', () => {
  it('no source file uses dangerouslySetInnerHTML', () => {
    const sourceFiles = findSourceFiles(SRC_DIR)
    const violations: string[] = []

    // Build the pattern from parts to avoid this test file matching itself
    const xssPattern = new RegExp(['dangerously', 'SetInnerHTML'].join(''))

    for (const filePath of sourceFiles) {
      // Skip this test file — it references the pattern name for auditing purposes
      if (filePath.replace(/\\/g, '/').includes('__tests__/security-audit')) continue

      const content = readFile(filePath)
      if (xssPattern.test(content)) {
        violations.push(relativePath(filePath))
      }
    }

    expect(
      violations,
      `These files use dangerouslySetInnerHTML (XSS risk):\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ===========================================================================
// 4. SQL INJECTION PREVENTION
// ===========================================================================

describe('SQL injection prevention', () => {
  it('all db.execute() calls use the sql tagged template literal', () => {
    const sourceFiles = findSourceFiles(SRC_DIR)
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      // Skip this test file — it references db.execute patterns for auditing purposes
      if (filePath.replace(/\\/g, '/').includes('__tests__/security-audit')) continue

      const content = readFile(filePath)

      // Find all db.execute( calls
      const executeRegex = /db\.execute\s*\(/g
      let match: RegExpExecArray | null

      while ((match = executeRegex.exec(content)) !== null) {
        // Get the context after db.execute(  — the next ~50 chars
        const afterExec = content.slice(match.index + match[0].length, match.index + match[0].length + 50)

        // The safe pattern is db.execute(sql`...`) — the argument starts with sql`
        // Unsafe would be db.execute("..." or db.execute(someVar or db.execute(`...`)
        if (!/^\s*sql\s*`/.test(afterExec)) {
          const lineNum = content.slice(0, match.index).split('\n').length
          violations.push(`${relativePath(filePath)}:${lineNum}`)
        }
      }
    }

    expect(
      violations,
      `These db.execute() calls do NOT use sql tagged template literal (SQL injection risk):\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no raw SQL string concatenation patterns detected', () => {
    const sourceFiles = findSourceFiles(SRC_DIR)
    const violations: string[] = []

    // Detect patterns like: db.execute("SELECT..." + variable) or db.execute(`SELECT...${var}`)
    // These are dangerous SQL injection vectors.
    for (const filePath of sourceFiles) {
      // Skip this test file — it references db.execute patterns for auditing purposes
      if (filePath.replace(/\\/g, '/').includes('__tests__/security-audit')) continue

      const content = readFile(filePath)

      // Pattern: db.execute( followed by a string literal (not sql`)
      // Matches db.execute("...) or db.execute('...) or db.execute(`... without sql prefix
      const unsafeExec = /db\.execute\s*\(\s*["'`]/.exec(content)
      if (unsafeExec) {
        const lineNum = content.slice(0, unsafeExec.index).split('\n').length
        violations.push(`${relativePath(filePath)}:${lineNum}`)
      }
    }

    expect(
      violations,
      `These files use string literals directly in db.execute() (SQL injection risk):\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ===========================================================================
// 5. SECURITY HEADERS
// ===========================================================================

describe('Security headers configuration', () => {
  const configPath = path.resolve(PROJECT_ROOT, 'next.config.ts')
  const configContent = readFile(configPath)

  it('Content-Security-Policy header is configured', () => {
    expect(configContent).toContain('Content-Security-Policy')
  })

  it('Strict-Transport-Security header is configured', () => {
    expect(configContent).toContain('Strict-Transport-Security')
  })

  it('X-Frame-Options header is configured', () => {
    expect(configContent).toContain('X-Frame-Options')
  })

  it('X-Content-Type-Options header is configured', () => {
    expect(configContent).toContain('X-Content-Type-Options')
  })

  it('Referrer-Policy header is configured', () => {
    expect(configContent).toContain('Referrer-Policy')
  })

  it('Permissions-Policy header is configured', () => {
    expect(configContent).toContain('Permissions-Policy')
  })

  it('CSP includes frame-ancestors directive for clickjacking prevention', () => {
    expect(configContent).toMatch(/frame-ancestors\s+'none'/)
  })

  it('HSTS includes includeSubDomains', () => {
    expect(configContent).toContain('includeSubDomains')
  })
})
