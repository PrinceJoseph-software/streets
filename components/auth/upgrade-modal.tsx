'use client'

import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  artistName: string
  onDismiss: () => void
}

type EmailStep = 'idle' | 'sending' | 'sent' | 'error'

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildCallbackUrl(upgrade = true): string {
  if (typeof window === 'undefined') return '/auth/callback'
  const next = encodeURIComponent(window.location.pathname)
  return `${window.location.origin}/auth/callback?next=${next}${upgrade ? '&upgrade=1' : ''}`
}

// ─── UpgradeModal ─────────────────────────────────────────────────────────────
// A full-screen fixed overlay. Rendered inside VoteButton so no extra provider
// is needed — position:fixed escapes any parent stacking context.

export function UpgradeModal({ artistName, onDismiss }: Props) {
  const posthog = usePostHog()
  const supabase = createClient()

  const [email,     setEmail]     = useState('')
  const [emailStep, setEmailStep] = useState<EmailStep>('idle')
  const [emailErr,  setEmailErr]  = useState('')
  const [oauthErr,  setOauthErr]  = useState('')

  // ── OAuth handlers ────────────────────────────────────────────────────────
  async function handleOAuth(provider: 'google' | 'twitter') {
    setOauthErr('')
    const redirectTo = buildCallbackUrl(true)

    // linkIdentity upgrades an anonymous user to permanent while keeping the UUID.
    // For users who aren't anonymous, this links an additional identity.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.auth as any).linkIdentity({
      provider,
      options: { redirectTo },
    })

    // If the user doesn't have an anonymous session yet, fall back to signInWithOAuth
    if (error) {
      const { error: fallbackErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (fallbackErr) {
        setOauthErr(fallbackErr.message ?? 'OAuth sign-in failed. Try email instead.')
      }
    }
    // On success: browser redirects to the OAuth provider — no further action needed here.
  }

  // ── Email handler ─────────────────────────────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailErr('')
    setEmailStep('sending')

    const redirectTo = buildCallbackUrl(true)

    // updateUser sends a magic link to the email.
    // On click: email is confirmed, is_anonymous → false, trigger fires.
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: redirectTo },
    )

    if (error) {
      setEmailErr(error.message ?? 'Could not send email. Try again.')
      setEmailStep('error')
    } else {
      setEmailStep('sent')
      posthog?.capture('auth_upgrade_email_sent')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      {/* Dim */}
      <div className="absolute inset-0 bg-ink opacity-60" aria-hidden />

      {/* Card */}
      <div
        className="relative w-full max-w-md bg-bone mx-auto px-6 pt-8 pb-10 sm:mx-4"
        role="dialog"
        aria-modal="true"
        aria-label="Lock in your vote"
      >
        {/* Close */}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-5 font-mono text-xs text-mute uppercase tracking-widest"
        >
          ✕
        </button>

        {/* Headline */}
        <h2 className="font-display text-4xl text-ink uppercase leading-none mb-3">
          Lock this in.
        </h2>
        <p className="font-body text-sm text-ink leading-relaxed mb-1">
          If <strong>{artistName}</strong> blows, you'll have proof you were here first.
        </p>
        <p className="font-mono text-xs text-mute mb-7">
          Your reactions are already saved. One tap to make it permanent.
        </p>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-ink opacity-20 mb-6" />

        {/* ── OAuth buttons ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={() => handleOAuth('google')}
            className="w-full py-4 border border-ink font-mono text-sm uppercase tracking-widest text-ink flex items-center justify-center gap-3 hover:bg-ink hover:text-bone transition-colors"
          >
            <span aria-hidden style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: '14px' }}>G</span>
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuth('twitter')}
            className="w-full py-4 bg-ink text-bone font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-90 transition-opacity"
          >
            <span aria-hidden style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: '14px' }}>𝕏</span>
            Continue with X
          </button>
        </div>

        {oauthErr && (
          <p className="font-mono text-xs text-falling mb-4" role="alert">{oauthErr}</p>
        )}

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-ink opacity-20" />
          <span className="font-mono text-xs text-mute uppercase tracking-widest">or email</span>
          <div className="flex-1 h-px bg-ink opacity-20" />
        </div>

        {/* ── Email form ───────────────────────────────────────────────── */}
        {emailStep === 'sent' ? (
          <p className="font-mono text-sm text-ink text-center py-4">
            Check your inbox — tap the link to lock in your history.
          </p>
        ) : (
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              disabled={emailStep === 'sending'}
            />
            {emailErr && (
              <p className="font-mono text-xs text-falling" role="alert">{emailErr}</p>
            )}
            {/* THE yellow element on this overlay-screen */}
            <button
              type="submit"
              disabled={emailStep === 'sending' || !email.trim()}
              className="highlight-yellow w-full py-4 font-mono text-sm uppercase tracking-widest disabled:opacity-50"
            >
              {emailStep === 'sending' ? 'Sending…' : 'Continue with Email'}
            </button>
          </form>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="font-mono text-xs text-mute uppercase tracking-widest text-center w-full mt-6"
        >
          Dismiss — continue browsing
        </button>
      </div>
    </div>
  )
}
