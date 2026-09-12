'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const client = createClient()
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError(authError.message)
        return
      }
      if (!data.session) {
        setError('Sign in did not create a session. Please try again.')
        return
      }
      router.replace('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <div className="auth-logo">UPC</div>
        <h1>Sign in</h1>
        <p>Sign in to your UPC customer account.</p>
        {error && <div className="error">{error}</div>}
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p>Don't have an account? <a href="/register">Create one</a></p>
        <a href="/">← Back to tracking</a>
      </form>
    </main>
  )
}
