'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-teal flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-navy" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">NearDrop</span>
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase">Dispatcher Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-8 shadow-2xl border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to continue</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="dispatcher@neardrop.in"
                className="w-full rounded-lg bg-navy border border-slate-600 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg bg-navy border border-slate-600 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-teal py-3 text-sm font-semibold text-navy hover:bg-teal-light active:bg-teal-dark disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          NearDrop Dispatcher — authorised personnel only
        </p>
      </div>
    </div>
  )
}
