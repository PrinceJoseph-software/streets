'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useReactions } from './reaction-provider'

// ─── types ─────────────────────────────────────────────────────────────────────

export interface RankRowTrack {
  rank: number
  momentum: number
  pulse: number
  tracks: {
    id: string
    title: string
    cover_url: string
    ext_url: string
    ext_platform: string
    artists: { name: string; slug: string; ignited_at: string | null }
    cities: { name: string }
  }
}

// ─── embed URL helpers ────────────────────────────────────────────────────────

function getEmbedUrl(extUrl: string, platform: string): string | null {
  try {
    const url = new URL(extUrl)
    switch (platform) {
      case 'audiomack': {
        // e.g. audiomack.com/artist/song → embed via pathname
        const src = url.pathname.slice(1) // strip leading /
        return `https://audiomack.com/embed/song?src=${encodeURIComponent(src)}`
      }
      case 'spotify': {
        return `https://open.spotify.com/embed${url.pathname}?utm_source=generator&theme=0`
      }
      case 'youtube': {
        const v = url.searchParams.get('v') ?? url.pathname.split('/').pop()
        if (!v) return null
        return `https://www.youtube.com/embed/${v}?autoplay=1`
      }
      case 'soundcloud':
        return null // open in new tab
      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── movement indicator ───────────────────────────────────────────────────────
// pulse < 0.5 means essentially no recent engagement — show neutral — regardless
// of momentum ratio (which would be 0/3 ≈ 0 and falsely read as "falling").
// ▼ only fires when there was real prior heat (pulse ≥ 0.5) that has since cooled.

function MovementBadge({ momentum, pulse }: { momentum: number; pulse: number }) {
  if (momentum >= 1.5) {
    return <span className="rank-up text-rising font-mono text-xs">▲</span>
  }
  if (momentum < 0.3 && pulse >= 0.5) {
    return <span className="rank-down text-falling font-mono text-xs">▼</span>
  }
  return <span className="font-mono text-xs text-mute">—</span>
}

// ─── reaction bar ─────────────────────────────────────────────────────────────

function ReactionBar({ trackId }: { trackId: string }) {
  const { counts, reactedIds, react } = useReactions()
  const count = counts[trackId] ?? 0
  const reacted = reactedIds.has(trackId)

  return (
    <button
      onClick={() => react(trackId)}
      aria-label={reacted ? 'Reacted' : 'React to this track'}
      className={[
        'flex items-center gap-1.5 font-mono text-xs transition-opacity',
        reacted ? 'opacity-100' : 'opacity-50 hover:opacity-100',
      ].join(' ')}
    >
      <span style={{ fontSize: '14px' }}>🔥</span>
      <span className="text-ink">{count}</span>
    </button>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  item: RankRowTrack
  showCity?: boolean
}

export function RankRow({ item, showCity = false }: Props) {
  const [playing, setPlaying] = useState(false)
  const { rank, momentum, pulse, tracks } = item
  const t = tracks
  const embedUrl = getEmbedUrl(t.ext_url, t.ext_platform)

  function handlePlay() {
    if (t.ext_platform === 'soundcloud') {
      window.open(t.ext_url, '_blank', 'noopener,noreferrer')
      return
    }
    setPlaying((p) => !p)
  }

  return (
    <div className="border-b border-ink border-opacity-10">
      {/* ── Main row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 py-3">
        {/* Rank number */}
        <div className="w-8 flex-shrink-0 text-right">
          <span className="font-mono text-xl font-bold text-ink leading-none">
            {rank}
          </span>
        </div>

        {/* Cover + play button */}
        <button
          onClick={handlePlay}
          aria-label={playing ? 'Collapse player' : `Play ${t.title}`}
          className="relative flex-shrink-0 w-12 h-12 bg-ink overflow-hidden group"
        >
          <Image
            src={t.cover_url || 'https://placehold.co/48x48/0a0a0a/f4f1ea?text=?'}
            alt={`${t.title} cover`}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-ink bg-opacity-0 group-hover:bg-opacity-50 transition-all">
            <span
              className="text-bone text-lg opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden
            >
              {playing ? '■' : '▶'}
            </span>
          </div>
        </button>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MovementBadge momentum={momentum} pulse={pulse} />
            {t.artists.ignited_at && (
              <span className="highlight-yellow font-mono text-xs px-1 leading-tight">
                IGNITED
              </span>
            )}
          </div>
          <p className="font-body font-semibold text-ink text-sm leading-tight truncate">
            {t.title}
          </p>
          <p className="font-body text-xs text-mute truncate">
            {t.artists.name}
            {showCity && ` · ${t.cities.name}`}
          </p>
        </div>

        {/* Reaction bar */}
        <div className="flex-shrink-0">
          <ReactionBar trackId={t.id} />
        </div>
      </div>

      {/* ── Lazy embed ───────────────────────────────────────────── */}
      {playing && embedUrl && (
        <div className="pb-3 pl-12">
          <iframe
            src={embedUrl}
            width="100%"
            height="120"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="border-0"
            title={`${t.title} — ${t.artists.name}`}
          />
        </div>
      )}
    </div>
  )
}
