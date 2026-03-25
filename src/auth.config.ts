import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'

/**
 * Edge-safe Auth.js configuration.
 * Imported by proxy.ts for route protection — must NOT import any Node.js-only
 * modules (pg, bcryptjs, etc.).
 *
 * The full Credentials authorize logic with DB access lives in src/auth.ts,
 * which overrides providers for the server runtime.
 */
export default {
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
      authorize: async () => {
        // Edge-safe stub — real verification happens in src/auth.ts
        return null
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig
