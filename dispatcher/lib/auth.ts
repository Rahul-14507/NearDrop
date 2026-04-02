import type { NextAuthOptions, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface BackendUser extends User {
  accessToken: string
  role: string
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<BackendUser | null> {
        if (!credentials?.email || !credentials?.password) return null

        let resp: Response
        try {
          resp = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              role: 'dispatcher',
            }),
          })
        } catch {
          return null
        }

        if (!resp.ok) return null

        const data = await resp.json() as {
          access_token: string
          name: string
          user_id: number
          role: string
        }

        return {
          id: String(data.user_id),
          name: data.name,
          email: credentials.email,
          accessToken: data.access_token,
          role: data.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const bu = user as BackendUser
        token.accessToken = bu.accessToken
        token.role = bu.role
      }
      return token
    },
    async session({ session, token }) {
      (session as Record<string, unknown>).accessToken = token.accessToken
      ;(session as Record<string, unknown>).role = token.role
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
}
