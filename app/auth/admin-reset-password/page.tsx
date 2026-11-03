'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function AdminResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    let active = true
    async function prepare() {
      const supabase = createClient()
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { if(active) setError('This reset link is invalid or expired. Request a new one.'); return }
      }
      const { data } = await supabase.auth.getSession()
      if (active) {
        if (data.session) setReady(true)
        else setError('This reset link is invalid or expired. Request a new one.')
      }
    }
    prepare()
    return () => { active = false }
  }, [])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setError('')
    setMessage('')
    if (password.length < 10) { setError('Use at least 10 characters for your new password.'); return }
    if (password !== confirm) { setError('The passwords do not match.'); return }
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    if (error) setError(error.message)
    else {
      setMessage('Your password has been changed. Please sign in with your new password.')
      await createClient().auth.signOut()
      setTimeout(() => router.replace('/admin/login'), 1200)
    }
    setBusy(false)
  }

  return <main className="auth"><form className="card auth-card" onSubmit={submit}>
    <div className="eyebrow">ADMIN CONSOLE</div><h1>Choose a new password</h1>
    <p>Set a strong password that you do not use on another website.</p>
    {message && <div className="success">{message}</div>}
    {error && <div className="error">{error}</div>}
    {ready && <>
      <label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={10} required /></label>
      <label>Confirm new password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={10} required /></label>
      <button className="btn btn-primary" disabled={busy}>{busy?'Updating…':'Update password'}</button>
    </>}
    {!ready && !error && <p>Checking your secure reset link…</p>}
    {error && <a href="/auth/admin-forgot-password">Request another reset link</a>}
  </form></main>
}
