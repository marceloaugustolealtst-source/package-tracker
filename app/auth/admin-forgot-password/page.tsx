'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function AdminForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    const redirectTo = new URL('/auth/admin-reset-password', window.location.origin).toString()
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) setError(error.message)
    else setMessage('If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.')
    setBusy(false)
  }

  return <main className="auth"><form className="card auth-card" onSubmit={submit}>
    <div className="eyebrow">ADMIN CONSOLE</div><h1>Reset admin password</h1>
    <p>Enter the email address connected to your authorized admin account. We’ll send a secure, one-time reset link.</p>
    {message && <div className="success">{message}</div>}
    {error && <div className="error">{error}</div>}
    <label>Admin email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></label>
    <button className="btn btn-primary" disabled={busy}>{busy?'Sending…':'Send reset link'}</button>
    <a href="/admin/login">← Back to admin sign in</a>
  </form></main>
}
