'use client'

import { useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@/lib/supabase/client'
import { useAuth }     from '@/lib/supabase/auth-provider'
import { UpgradeModal } from '@/components/auth/upgrade-modal'

interface Props {
  trackId: string
  artistName: string
  nextSupporterNumber: number
  /** Called when the user casts a NEW vote this session. */
  onVoteSuccess?: () => void
  /** Called on mount when we detect the user already voted in a prior session. */
  onAlreadyVoted?: () => void
}

type VoteState = 'idle' | 'voting' | 'voted' | 'show-upgrade'

export function VoteButton({ trackId, artistName, nextSupporterNumber, onVoteSuccess, onAlreadyVoted }: Props) {
  const posthog                     = usePostHog()
  const { user, isAnonymous, isLoading: authLoading } = useAuth()
  const [voteState, setVoteState]   = useState<VoteState>('idle')
  const [checkingVoted, setChecking] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // ── Check if registered user already voted this track ─────────────────────
  useEffect(() => {
    if (authLoading || isAnonymous || !user) return

    setChecking(true)
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('engagement_events')
      .select('id')
      .eq('track_id', trackId)
      .eq('user_id', user.id)
      .eq('kind', 'vote')
      .maybeSingle()
      .then(({ data }: { data: unknown }) => {
        if (data) {
          setVoteState('voted')
          onAlreadyVoted?.()
        }
        setChecking(false)
      })
  }, [user, isAnonymous, authLoading, trackId])

  // ── Cast vote ──────────────────────────────────────────────────────────────
  async function handleVote() {
    // Anonymous → show upgrade prompt (no wasted RPC call)
    if (isAnonymous) {
      setVoteState('show-upgrade')
      return
    }
    if (voteState === 'voting' || voteState === 'voted') return

    setVoteState('voting')
    setError(null)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc('cast_vote', {
      p_track_id: trackId,
    })

    if (!rpcError) {
      setVoteState('voted')
      posthog?.capture('vote', { track_id: trackId, artist_name: artistName })
      onVoteSuccess?.()
      return
    }

    const msg: string = rpcError.message ?? ''

    if (msg.includes('signed in') || msg.includes('permanent account') || msg.includes('anonymous')) {
      setVoteState('show-upgrade')
    } else if (msg.includes('already_voted') || rpcError.code === '23505') {
      setVoteState('voted')
    } else {
      setVoteState('idle')
      setError(msg || 'Something went wrong. Try again.')
    }
  }

  // ── Loading: auth or voted-check in progress ───────────────────────────────
  const isChecking = authLoading || checkingVoted

  if (isChecking) {
    return (
      <div className="w-full py-5 font-mono text-sm uppercase tracking-widest text-center text-mute">
        …
      </div>
    )
  }

  // ── Voted state ────────────────────────────────────────────────────────────
  if (voteState === 'voted') {
    return (
      <div className="w-full flex flex-col gap-2">
        <div className="w-full py-5 font-mono text-sm uppercase tracking-widest text-center border border-ink border-opacity-30 text-mute">
          ✓ You backed {artistName}
        </div>
        <p className="font-mono text-xs text-mute text-center">
          Rank updates every few minutes.
        </p>
      </div>
    )
  }

  // ── Main CTA ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full flex flex-col gap-2">
        {/* THE yellow element on this screen */}
        <button
          onClick={handleVote}
          disabled={voteState === 'voting'}
          className="highlight-yellow w-full py-5 font-mono text-base uppercase tracking-widest disabled:opacity-50 transition-opacity"
        >
          {voteState === 'voting'
            ? 'Backing…'
            : isAnonymous
            ? `Back this artist — be #${nextSupporterNumber}`
            : `Back this artist — be #${nextSupporterNumber}`}
        </button>

        {error && (
          <p className="font-mono text-xs text-falling" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Upgrade modal — fixed overlay, rendered in-place but visually full-screen */}
      {voteState === 'show-upgrade' && (
        <UpgradeModal
          artistName={artistName}
          onDismiss={() => setVoteState('idle')}
        />
      )}
    </>
  )
}
