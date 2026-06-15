'use client'

import { useState } from 'react'
import { ArtistHero }             from './artist-hero'
import { RankSparkline }          from './rank-sparkline'
import { SupporterLedgerPreview } from './supporter-ledger-preview'
import type { ArtistHeroProps }   from './artist-hero'
import type { SupporterRow }      from './supporter-ledger-preview'

// ─── types ─────────────────────────────────────────────────────────────────────

interface Props {
  artist:             ArtistHeroProps['artist']
  topTrack:           ArtistHeroProps['topTrack']
  ranking:            ArtistHeroProps['ranking']
  isIgnited:          boolean
  /** COUNT of distinct voters in engagement_events at page render time. */
  initialBackerCount: number
  /** For the sealed post-Ignition ledger only. */
  supporterCount:     number
  supporters:         SupporterRow[]
}

// ─── ArtistVoteIsland ─────────────────────────────────────────────────────────
// Single client island that owns the shared vote state for the whole artist page.
// Renders: above-fold hero → rank sparkline → live backers / sealed ledger.
// ISR can be as aggressive as we like because the live count updates immediately
// via client state — no page reload, no 3-minute wait.

export function ArtistVoteIsland({
  artist,
  topTrack,
  ranking,
  isIgnited,
  initialBackerCount,
  supporterCount,
  supporters,
}: Props) {
  const [backerCount, setBackerCount] = useState(initialBackerCount)
  // voted: viewer is in the backer cohort (now or from a prior session)
  // voteWasNew: they cast the vote THIS session (not detected on mount)
  const [voted,      setVoted]      = useState(false)
  const [voteWasNew, setVoteWasNew] = useState(false)

  function onVoteSuccess() {
    setBackerCount((c) => c + 1)
    setVoted(true)
    setVoteWasNew(true)
  }

  function onAlreadyVoted() {
    // Their vote is already in the server-fetched count — don't double-count.
    setVoted(true)
    setVoteWasNew(false)
  }

  return (
    <>
      {/* ── Above fold ──────────────────────────────────────────────────── */}
      <ArtistHero
        artist={artist}
        topTrack={topTrack}
        ranking={ranking}
        nextSupporterNumber={backerCount + 1}
        onVoteSuccess={onVoteSuccess}
        onAlreadyVoted={onAlreadyVoted}
      />

      {/* ── Below fold ──────────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="w-full h-px bg-ink opacity-20 mb-8" />

        <RankSparkline
          currentRank={ranking?.rank ?? null}
          history={ranking ? [ranking.rank] : []}
        />

        <div className="w-full h-px bg-ink opacity-20 mb-8" />

        {isIgnited ? (
          /* Post-Ignition: sealed ledger — unchanged from Phase 5 */
          <SupporterLedgerPreview
            isIgnited={true}
            supporterCount={supporterCount}
            voteCount={0}
            supporters={supporters}
            nextSupporterNumber={0}
          />
        ) : (
          /* Pre-Ignition: live backer count driven by client state */
          <BackersSection
            backerCount={backerCount}
            voted={voted}
            voteWasNew={voteWasNew}
          />
        )}
      </div>
    </>
  )
}

// ─── BackersSection ───────────────────────────────────────────────────────────
// Pure inline component — receives live state, no hooks.
// Copy spec:
//   count === 0 && !voted   → "Nobody's backed this yet. Be #1."
//   voted  && voteWasNew    → "You're backer #{count}. You're early."
//   voted  && !voteWasNew   → "You backed this. {count} backers so far."
//   count > 0  && !voted    → "{count} backers so far. Still early."

function BackersSection({
  backerCount,
  voted,
  voteWasNew,
}: {
  backerCount: number
  voted: boolean
  voteWasNew: boolean
}) {
  return (
    <div>
      <p className="font-mono text-xs text-mute uppercase tracking-widest mb-3">
        Backers
      </p>

      {voted && voteWasNew ? (
        /* Just voted this session */
        <>
          <p className="font-display text-3xl text-ink uppercase leading-tight mb-3">
            You're backer #{backerCount}.<br />You're early.
          </p>
          <p className="font-mono text-xs text-mute">
            Your spot finalizes at Ignition.
          </p>
        </>
      ) : voted ? (
        /* Previously voted, detected on mount */
        <>
          <p className="font-mono text-sm text-ink mb-3">
            <span className="font-mono text-2xl font-bold">{backerCount}</span>{' '}
            {backerCount === 1 ? 'backer' : 'backers'} so far. You're one of them.
          </p>
          <p className="font-mono text-xs text-mute">
            Your spot finalizes at Ignition.
          </p>
        </>
      ) : backerCount === 0 ? (
        /* No backers yet, viewer hasn't voted */
        <>
          <p className="font-display text-3xl text-ink uppercase leading-tight mb-4">
            Nobody's backed this yet.<br />Be #1.
          </p>
          <p className="font-mono text-xs text-mute leading-relaxed">
            Back them before Ignition and earn a permanent spot on the ledger.
          </p>
        </>
      ) : (
        /* Backers exist, viewer hasn't voted */
        <>
          <p className="font-mono text-sm text-ink mb-4">
            <span className="font-mono text-2xl font-bold">{backerCount}</span>{' '}
            {backerCount === 1 ? 'backer' : 'backers'} so far. Still early.
          </p>
          <p className="font-mono text-xs text-mute leading-relaxed">
            Back them before Ignition and earn a permanent spot on the ledger.
          </p>
        </>
      )}
    </div>
  )
}
