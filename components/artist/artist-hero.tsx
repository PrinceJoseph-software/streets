'use client'

import { useState } from 'react'
import Image from 'next/image'
import { VoteButton } from './vote-button'

// ─── types ─────────────────────────────────────────────────────────────────────

export interface ArtistHeroProps {
  artist: {
    id: string
    name: string
    slug: string
    city: string
    ignitedAt: string | null
  }
  topTrack: {
    id: string
    title: string
    coverUrl: string
    extUrl: string
    extPlatform: string
    genre: string
  } | null
  ranking: {
    rank: number
    momentum: number
  } | null
  nextSupporterNumber: number
}

// ─── embed URL helper ──────────────────────────────────────────────────────────

function getEmbedUrl(extUrl: string, platform: string): string | null {
  try {
    const url = new URL(extUrl)
    switch (platform) {
      case 'audiomack': {
        const src = url.pathname.slice(1)
        return `https://audiomack.com/embed/song?src=${encodeURIComponent(src)}`
      }
      case 'spotify':
        return `https://open.spotify.com/embed${url.pathname}?utm_source=generator&theme=0`
      case 'youtube': {
        const v = url.searchParams.get('v') ?? url.pathname.split('/').pop()
        return v ? `https://www.youtube.com/embed/${v}?autoplay=1` : null
      }
      case 'soundcloud':
        return null
      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── movement badge ───────────────────────────────────────────────────────────

function MovementBadge({ momentum }: { momentum: number }) {
  if (momentum >= 1.5) {
    return (
      <span className="rank-up font-mono text-sm text-rising uppercase tracking-widest">
        ▲ Rising
      </span>
    )
  }
  if (momentum < 0.3) {
    return (
      <span className="rank-down font-mono text-sm text-falling uppercase tracking-widest">
        ▼ Falling
      </span>
    )
  }
  return null
}

// ─── ArtistHero ───────────────────────────────────────────────────────────────

export function ArtistHero({
  artist,
  topTrack,
  ranking,
  nextSupporterNumber,
}: ArtistHeroProps) {
  const [playing, setPlaying] = useState(false)

  const embedUrl = topTrack
    ? getEmbedUrl(topTrack.extUrl, topTrack.extPlatform)
    : null

  function handlePlay() {
    if (!topTrack) return
    if (topTrack.extPlatform === 'soundcloud') {
      window.open(topTrack.extUrl, '_blank', 'noopener,noreferrer')
      return
    }
    setPlaying((p) => !p)
  }

  return (
    <div className="pt-8 pb-6">
      {/* ── Cover + artist info ────────────────────────────────────────── */}
      <div className="flex items-start gap-5 mb-6">
        {/* Cover — tappable to play */}
        <button
          onClick={handlePlay}
          aria-label={playing ? 'Collapse player' : `Play ${topTrack?.title ?? ''}`}
          disabled={!topTrack}
          className="relative flex-shrink-0 w-24 h-24 bg-ink overflow-hidden group disabled:cursor-default"
        >
          {topTrack ? (
            <Image
              src={topTrack.coverUrl || 'https://placehold.co/96x96/0a0a0a/f4f1ea?text=?'}
              alt={`${artist.name} cover`}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              priority
            />
          ) : (
            <div className="w-full h-full bg-ink" />
          )}
          {/* Play overlay */}
          {topTrack && (
            <div className="absolute inset-0 bg-ink bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
              <span className="text-bone text-xl opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
                {playing ? '■' : '▶'}
              </span>
            </div>
          )}
        </button>

        {/* Artist name + meta */}
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="font-display text-4xl text-ink uppercase leading-none break-words">
            {artist.name}
          </h1>

          <p className="font-mono text-xs text-mute uppercase tracking-widest mt-2">
            {[artist.city, topTrack?.genre].filter(Boolean).join(' · ')}
          </p>

          {/* Rank + movement */}
          <div className="flex items-baseline gap-3 mt-3">
            {ranking ? (
              <>
                <span className="font-mono text-4xl font-bold text-ink leading-none">
                  #{ranking.rank}
                </span>
                <MovementBadge momentum={ranking.momentum} />
              </>
            ) : (
              <span className="font-mono text-xs text-mute uppercase tracking-widest">
                Not yet ranked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Lazy embed ─────────────────────────────────────────────────── */}
      {playing && embedUrl && (
        <div className="mb-5">
          <iframe
            src={embedUrl}
            width="100%"
            height="120"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="border-0"
            title={`${topTrack?.title ?? ''} — ${artist.name}`}
          />
        </div>
      )}

      {/* ── Play text link ──────────────────────────────────────────────── */}
      {topTrack && (
        <button
          onClick={handlePlay}
          className="w-full flex items-center gap-3 py-3 border-t border-b border-ink border-opacity-10 text-left mb-5"
        >
          <span className="font-mono text-sm text-ink" aria-hidden>
            {playing ? '■' : '▶'}
          </span>
          <span className="font-body text-sm text-ink truncate">
            {playing ? 'Collapse player' : topTrack.title}
          </span>
          {topTrack.extPlatform === 'soundcloud' && (
            <span className="font-mono text-xs text-mute uppercase ml-auto">
              Opens SoundCloud ↗
            </span>
          )}
        </button>
      )}

      {/* ── Vote CTA + share ────────────────────────────────────────────── */}
      {topTrack ? (
        <div className="flex flex-col gap-3">
          <VoteButton
            trackId={topTrack.id}
            artistName={artist.name}
            nextSupporterNumber={nextSupporterNumber}
          />
          <ShareButton artistName={artist.name} slug={artist.slug} />
        </div>
      ) : (
        <p className="font-mono text-xs text-mute uppercase tracking-widest">
          No tracks submitted yet.
        </p>
      )}
    </div>
  )
}

// ─── Share button ─────────────────────────────────────────────────────────────

function ShareButton({ artistName, slug }: { artistName: string; slug: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/a/${slug}?src=card`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${artistName} on Streets`, url })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="font-mono text-xs text-mute uppercase tracking-widest text-center py-2"
    >
      {copied ? 'Link copied ✓' : 'Share this artist ↗'}
    </button>
  )
}
