import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/db'
import {
  users,
  authAccounts,
  authSessions,
  authVerificationTokens,
  households,
} from '@/db/schema'
import Google from 'next-auth/providers/google'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

/**
 * Auth.js v5 configuration with Drizzle adapter.
 *
 * Providers:
 *   - Google OAuth
 *   - Microsoft Entra ID (Azure AD) OAuth
 *   - Email/password credentials (bcrypt + PEPPER_SECRET)
 *
 * Session strategy: JWT (required for Credentials provider in Auth.js v5).
 *
 * Observability:
 *   - Set AUTH_DEBUG=true for verbose auth event logging
 *   - GET /api/auth/session returns current session JSON
 *   - Credential failures return null (no secret leakage)
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  session: { strategy: 'jwt' },
  debug: process.env.AUTH_DEBUG === 'true',
  providers: [
    Google,
    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email as string
        const password = credentials.password as string

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
        if (!user || !user.password_hash) return null

        const pepper = process.env.PEPPER_SECRET ?? ''
        const valid = await bcrypt.compare(
          password + pepper,
          user.password_hash,
        )
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string
        // Look up householdId from the users table for downstream API routes
        const [dbUser] = await db
          .select({ household_id: users.household_id })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1)
        if (dbUser?.household_id) {
          session.householdId = dbUser.household_id
        }
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // Auto-create a household for OAuth users on first sign-in.
      // Follows the same 3-query pattern as the register route:
      // 1. Insert household
      // 2. Link user to household
      // 3. Set household owner
      try {
        const householdName = user.name
          ? `${user.name}'s Budget`
          : 'My Budget'

        const [household] = await db
          .insert(households)
          .values({ name: householdName })
          .returning()

        await db
          .update(users)
          .set({ household_id: household.id })
          .where(eq(users.id, user.id!))

        await db
          .update(households)
          .set({ owner_id: user.id! })
          .where(eq(households.id, household.id))
      } catch (error) {
        console.error(
          '[auth] Failed to create household for new user:',
          error instanceof Error ? error.message : error,
        )
      }
    },
  },
  pages: {
    signIn: '/login',
  },
})
