'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@/lib/supabase/client'
import { submitTrack } from '@/app/actions/submit-track'
import type { User } from '@supabase/supabase-js'

// ─── types ─────────────────────────────────────────────────────────────────────
type Genre  = { id: string; name: string; slug: string }
type City   = { id: string; name: string; slug: string }
type Status = 'idle' | 'uploading' | 'submitting' | 'success' | 'error'

type Fields = {
  url:        string
  artistName: string
  trackTitle: string
  genreId:    string
  cityId:     string
  pitch:      string
}

// ─── platform detection ────────────────────────────────────────────────────────
const PLATFORMS: Record<string, { label: string; pattern: RegExp }> = {
  audiomack:  { label: 'AUDIOMACK',   pattern: /audiomack\.com/i },
  spotify:    { label: 'SPOTIFY',     pattern: /spotify\.com/i   },
  youtube:    { label: 'YOUTUBE',     pattern: /youtube\.com|youtu\.be/i },
  soundcloud: { label: 'SOUNDCLOUD',  pattern: /soundcloud\.com/i },
}

function detectPlatform(url: string): string | null {
  for (const [key, { pattern }] of Object.entries(PLATFORMS)) {
    if (pattern.test(url)) return key
  }
  return null
}

// ─── cover compression ─────────────────────────────────────────────────────────
const MAX_PX   = 800   // max dimension after resize
const QUALITY  = 0.82  // JPEG quality — good balance for mobile data
const MAX_BYTES = 5 * 1024 * 1024  // 5 MB pre-compression

async function compressCover(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale   = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas unavailable')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

// ─── SubmitForm ────────────────────────────────────────────────────────────────
export function SubmitForm({ genres, cities }: { genres: Genre[]; cities: City[] }) {
  const posthog    = usePostHog()
  const supabase   = createClient()
  const fileRef    = useRef<HTMLInputElement>(null)

  const [user,    setUser]    = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── Minimal sign-in state (temp until Phase 6 auth UI) ──────────────────────
  const [signInEmail,    setSignInEmail]    = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [signInError,    setSignInError]    = useState('')
  const [signingIn,      setSigningIn]      = useState(false)

  const [fields,      setFields]       = useState<Fields>({
    url: '', artistName: '', trackTitle: '', genreId: '', cityId: '', pitch: '',
  })
  const [platform,    setPlatform]     = useState<string | null>(null)
  const [coverFile,   setCoverFile]    = useState<File | null>(null)
  const [coverPreview,setCoverPreview] = useState<string | null>(null)
  const [coverSizeKb, setCoverSizeKb] = useState<number | null>(null)
  const [errors,      setErrors]       = useState<Partial<Record<keyof Fields | 'cover' | 'server', string>>>({})
  const [status,      setStatus]       = useState<Status>('idle')
  const [copied,      setCopied]       = useState(false)
  const [shareResult, setShareResult]  = useState<{ artistSlug: string; trackId: string } | null>(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user?.is_anonymous ? null : user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user
      setUser(u?.is_anonymous ? null : u ?? null)
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignInError('')
    setSigningIn(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail, password: signInPassword,
    })
    if (error) setSignInError(error.message)
    setSigningIn(false)
  }

  // ── Field helpers ────────────────────────────────────────────────────────────
  const setField = (key: keyof Fields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const val = e.target.value
    setFields(prev => ({ ...prev, [key]: val }))
    // Clear error on change
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
    // Live platform detection
    if (key === 'url') setPlatform(detectPlatform(val))
  }

  // ── Cover file handling ──────────────────────────────────────────────────────
  const handleCoverFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, cover: 'Must be an image file (JPEG, PNG, WebP).' }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors(prev => ({ ...prev, cover: 'Cover must be under 5 MB.' }))
      return
    }
    setErrors(prev => ({ ...prev, cover: '' }))
    setCoverFile(file)
    setCoverSizeKb(Math.round(file.size / 1024))
    // Revoke previous preview URL
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(URL.createObjectURL(file))
  }, [coverPreview])

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleCoverFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleCoverFile(file)
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: typeof errors = {}
    if (!fields.url.trim())        next.url        = 'Paste a music link.'
    else if (!detectPlatform(fields.url)) {
      try { new URL(fields.url) } catch { next.url = 'Must be a valid URL.' }
      if (!next.url) next.url = 'Only Audiomack, Spotify, YouTube, SoundCloud supported.'
    }
    if (!fields.artistName.trim()) next.artistName = 'Artist name is required.'
    if (!fields.trackTitle.trim()) next.trackTitle  = 'Track title is required.'
    if (!fields.genreId)           next.genreId    = 'Select a genre.'
    if (!fields.cityId)            next.cityId     = 'Select a city.'
    if (!coverFile)                next.cover      = 'Upload a cover image.'
    if (fields.pitch.length > 280) next.pitch      = 'Max 280 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      // 1. Compress cover
      setStatus('uploading')
      const blob = await compressCover(coverFile!)
      const compressedKb = Math.round(blob.size / 1024)
      setCoverSizeKb(compressedKb)

      // 2. Upload to Supabase Storage
      const ext    = 'jpg'
      const key    = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('covers')
        .upload(key, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })

      if (uploadErr || !uploadData) {
        throw new Error(uploadErr?.message ?? 'Cover upload failed.')
      }

      const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(uploadData.path)

      // 3. Call server action
      setStatus('submitting')
      const result = await submitTrack({
        artistName:  fields.artistName.trim(),
        trackTitle:  fields.trackTitle.trim(),
        genreId:     fields.genreId,
        cityId:      fields.cityId,
        extUrl:      fields.url.trim(),
        extPlatform: platform ?? 'audiomack',
        coverUrl:    publicUrl,
        pitch:       fields.pitch.trim(),
      })

      if (!result.success) {
        setStatus('error')
        setErrors(prev => ({ ...prev, server: result.error }))
        return
      }

      // 4. Track event
      posthog?.capture('track_submitted', {
        platform:   platform,
        genre_id:   fields.genreId,
        city_id:    fields.cityId,
        has_pitch:  fields.pitch.trim().length > 0,
      })

      setShareResult({ artistSlug: result.artistSlug, trackId: result.trackId })
      setStatus('success')

    } catch (err) {
      setStatus('error')
      setErrors(prev => ({
        ...prev,
        server: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      }))
    }
  }

  // ── Share CTA ────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!shareResult) return
    const origin  = window.location.origin
    const pageUrl = `${origin}/a/${shareResult.artistSlug}?src=card`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${fields.artistName} is on the streets`, url: pageUrl })
        posthog?.capture('share_card_repost', { trackId: shareResult.trackId, method: 'native' })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      posthog?.capture('share_card_repost', { trackId: shareResult.trackId, method: 'clipboard' })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Render: auth loading ─────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <p className="font-mono text-mute text-sm uppercase tracking-widest mt-12 text-center">
        Loading…
      </p>
    )
  }

  // ── Render: not signed in ────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="w-full max-w-md mx-auto mt-12 flex flex-col gap-6">
        <p className="font-mono text-sm text-mute uppercase tracking-widest">
          Sign in to submit a track
        </p>

        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <Field label="Email" error="">
            <input
              type="email" required autoComplete="email"
              value={signInEmail} onChange={e => setSignInEmail(e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Password" error="">
            <input
              type="password" required autoComplete="current-password"
              value={signInPassword} onChange={e => setSignInPassword(e.target.value)}
              className="form-input"
            />
          </Field>
          {signInError && (
            <p className="font-mono text-xs text-falling">{signInError}</p>
          )}
          <button
            type="submit" disabled={signingIn}
            className="highlight-yellow w-full py-4 font-mono text-sm uppercase tracking-widest mt-2 disabled:opacity-50"
          >
            {signingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="font-mono text-xs text-mute text-center">
          Test: tochi@streets.dev / Streets2025!
        </p>
      </div>
    )
  }

  // ── Render: success ──────────────────────────────────────────────────────────
  if (status === 'success' && shareResult) {
    return (
      <div className="w-full max-w-sm mx-auto mt-8 flex flex-col items-center gap-8">
        {/* Headline */}
        <div className="w-full text-left">
          <h2 className="font-display text-5xl text-ink uppercase leading-none">
            You're on<br />the streets.
          </h2>
          <p className="font-mono text-sm text-mute uppercase tracking-widest mt-3">
            {fields.artistName} is live. Now make it move.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-ink opacity-20" />

        {/* Share card preview — the growth loop */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/card/artist/${shareResult.trackId}`}
          alt={`${fields.artistName} rank card`}
          width={360}
          height={450}
          className="w-full shadow-md"
          loading="eager"
        />

        {/* Repost CTA — P0 per blueprint §18 */}
        <button
          onClick={handleShare}
          className="highlight-yellow w-full py-5 font-mono text-base uppercase tracking-widest"
        >
          {copied ? 'Link copied ✓' : 'Repost this'}
        </button>

        <a
          href={`/a/${shareResult.artistSlug}`}
          className="font-mono text-xs text-mute uppercase tracking-widest"
        >
          View artist page →
        </a>
      </div>
    )
  }

  // ── Render: form ─────────────────────────────────────────────────────────────
  const busy = status === 'uploading' || status === 'submitting'

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-md mx-auto mt-8 flex flex-col gap-8"
    >
      {/* ── Music link ─────────────────────────────────────────────────────── */}
      <Field label="Music link *" error={errors.url}>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="audiomack.com/…"
          value={fields.url}
          onChange={setField('url')}
          className="form-input"
          aria-describedby={errors.url ? 'url-err' : undefined}
        />
        {/* Platform badge — appears as the user types */}
        {platform && !errors.url && (
          <span className="font-mono text-xs text-rising uppercase tracking-widest mt-1 block">
            {PLATFORMS[platform]?.label} ✓
          </span>
        )}
        {!platform && fields.url && !errors.url && (
          <span className="font-mono text-xs text-mute uppercase tracking-widest mt-1 block">
            Audiomack · Spotify · YouTube · SoundCloud
          </span>
        )}
      </Field>

      {/* ── Artist + track ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <Field label="Artist name *" error={errors.artistName}>
          <input
            type="text"
            autoComplete="off"
            maxLength={60}
            value={fields.artistName}
            onChange={setField('artistName')}
            className="form-input"
          />
        </Field>

        <Field label="Track title *" error={errors.trackTitle}>
          <input
            type="text"
            autoComplete="off"
            maxLength={100}
            value={fields.trackTitle}
            onChange={setField('trackTitle')}
            className="form-input"
          />
        </Field>
      </div>

      {/* ── Genre + city ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-4">
        <Field label="Genre *" error={errors.genreId} className="flex-1">
          <select
            value={fields.genreId}
            onChange={setField('genreId')}
            className="form-input form-select"
          >
            <option value="">Select…</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>

        <Field label="City *" error={errors.cityId} className="flex-1">
          <select
            value={fields.cityId}
            onChange={setField('cityId')}
            className="form-input form-select"
          >
            <option value="">Select…</option>
            {cities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Cover image ────────────────────────────────────────────────────── */}
      <Field label="Cover image *" error={errors.cover}>
        {/* Tap/drag zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          aria-label="Upload cover image"
          className={[
            'relative flex items-center justify-center',
            'border-2 cursor-pointer transition-colors',
            'min-h-[160px]',
            errors.cover
              ? 'border-falling'
              : coverFile
              ? 'border-ink'
              : 'border-mute hover:border-ink focus:border-ink outline-none',
          ].join(' ')}
        >
          {coverPreview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={coverPreview}
              alt="Cover preview"
              className="w-full h-full object-cover max-h-64"
            />
          ) : (
            <div className="text-center p-8">
              <p className="font-mono text-sm text-mute uppercase tracking-widest">
                Tap to upload
              </p>
              <p className="font-mono text-xs text-mute mt-1 opacity-60">
                JPEG · PNG · WebP · max 5 MB
              </p>
            </div>
          )}

          {/* Size badge after selection */}
          {coverFile && coverSizeKb && (
            <span className="absolute bottom-2 right-2 bg-ink text-bone font-mono text-xs px-2 py-1">
              {coverSizeKb}KB
            </span>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverChange}
          className="sr-only"
          aria-hidden
        />
      </Field>

      {/* ── Pitch (optional) ───────────────────────────────────────────────── */}
      <Field label={`Why this blows ${fields.pitch.length}/280`} error={errors.pitch}>
        <textarea
          rows={3}
          maxLength={280}
          placeholder="Optional — convince the streets."
          value={fields.pitch}
          onChange={setField('pitch')}
          className="form-input resize-none"
        />
      </Field>

      {/* ── Server error ───────────────────────────────────────────────────── */}
      {errors.server && (
        <p className="font-mono text-sm text-falling" role="alert">
          {errors.server}
        </p>
      )}

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={busy}
        className="highlight-yellow w-full py-5 font-mono text-base uppercase tracking-widest disabled:opacity-50"
      >
        {status === 'uploading'  ? 'Uploading cover…'  :
         status === 'submitting' ? 'Submitting…'       :
                                   'Submit track'}
      </button>
    </form>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
  label, error, children, className = '',
}: {
  label: string
  error: string | undefined
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="font-mono text-xs text-mute uppercase tracking-widest">
        {label}
      </label>
      {children}
      {error && (
        <p className="font-mono text-xs text-falling mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
