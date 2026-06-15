import { ImageResponse } from 'next/og'
import { createPublicClient } from '@/lib/supabase/public'
import { antonFont, monoFont } from '@/lib/og-fonts'

export const runtime = 'nodejs'

const W = 1080
const H = 1350
const PAD = 80

const INK    = '#0A0A0A'
const BONE   = '#F4F1EA'
const YELLOW = '#FFE000'
const RISING = '#1FAE6B'
const MUTE   = '#8A857A'

function Rule({ color = BONE, opacity = 1 }: { color?: string; opacity?: number }) {
  return (
    <div
      style={{
        width:           '100%',
        height:          2,
        backgroundColor: color,
        opacity,
        flexShrink:      0,
      }}
    />
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ledgerId: string }> },
) {
  const { ledgerId } = await params
  const supabase = createPublicClient()

  // Fetch ledger row with related artist, track, and user
  const { data: ledger } = await supabase
    .from('supporter_ledger')
    .select(`
      supporter_rank,
      weeks_early,
      artists ( name ),
      tracks  ( title ),
      users   ( handle, accuracy )
    `)
    .eq('id', ledgerId)
    .single()

  if (!ledger) {
    return new Response('Ledger entry not found', { status: 404 })
  }

  // Coerce Supabase FK objects (may be array or single object)
  const artist = Array.isArray(ledger.artists) ? ledger.artists[0] : ledger.artists
  const track  = Array.isArray(ledger.tracks)  ? ledger.tracks[0]  : ledger.tracks
  const user   = Array.isArray(ledger.users)   ? ledger.users[0]   : ledger.users

  const artistName = (artist?.name   ?? 'UNKNOWN').toUpperCase()
  const trackTitle = track?.title    ?? ''
  const handle     = user?.handle    ? `@${user.handle}` : '@fan'
  const accuracy   = user?.accuracy  ?? null

  const supporterRank = ledger.supporter_rank
  const weeksEarly    = Math.round(Number(ledger.weeks_early) * 10) / 10

  // Truncate long artist names
  const displayName = artistName.length > 12
    ? artistName.slice(0, 11) + '…'
    : artistName

  return new ImageResponse(
    (
      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          width:           W,
          height:          H,
          backgroundColor: INK,
          padding:         PAD,
          fontFamily:      'Anton',
        }}
      >
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: BONE, fontSize: 32, fontFamily: 'Anton', letterSpacing: 6 }}>
            STREETS
          </span>
          <span style={{ color: MUTE, fontSize: 18, fontFamily: 'JetBrains Mono', letterSpacing: 3 }}>
            EARLY SUPPORTER
          </span>
        </div>

        <div style={{ marginTop: 40, display: 'flex' }}>
          <Rule />
        </div>

        {/* ── Hero statement ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 56 }}>
          <span
            style={{
              color:       BONE,
              fontSize:    96,
              fontFamily:  'Anton',
              lineHeight:  0.92,
              letterSpacing: -1,
            }}
          >
            I CALLED IT
          </span>
          <span
            style={{
              color:       BONE,
              fontSize:    96,
              fontFamily:  'Anton',
              lineHeight:  0.92,
              letterSpacing: -1,
            }}
          >
            FIRST.
          </span>
        </div>

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex' }} />

        {/* ── Two hero stats ───────────────────────────────────────────── */}
        {/* RULE: yellow is on supporter_rank (the primary status symbol).   */}
        {/* weeks_early is rendered in bone — only ONE yellow per card.       */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 48 }}>

          {/* supporter_rank — THE ONE YELLOW ELEMENT */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                backgroundColor: YELLOW,
                padding:         '16px 36px',
                display:         'flex',
              }}
            >
              <span
                style={{
                  color:      INK,   // ink on yellow
                  fontSize:   supporterRank >= 100 ? 80 : 110,
                  fontFamily: 'JetBrains Mono',
                  lineHeight: 1,
                }}
              >
                #{supporterRank}
              </span>
            </div>
            <span
              style={{
                color:       MUTE,
                fontSize:    16,
                fontFamily:  'JetBrains Mono',
                marginTop:   12,
                letterSpacing: 3,
              }}
            >
              SUPPORTER
            </span>
          </div>

          {/* weeks_early — bone, no yellow (rule: only one yellow element) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                color:      BONE,
                fontSize:   110,
                fontFamily: 'JetBrains Mono',
                lineHeight: 1,
              }}
            >
              {weeksEarly}WK
            </span>
            <span
              style={{
                color:       MUTE,
                fontSize:    16,
                fontFamily:  'JetBrains Mono',
                marginTop:   12,
                letterSpacing: 3,
              }}
            >
              BEFORE IGNITION
            </span>
          </div>
        </div>

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex' }} />

        {/* ── Artist + track ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', marginBottom: 0 }}>
          <Rule />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 }}>
          <span
            style={{
              color:       BONE,
              fontSize:    displayName.length > 8 ? 90 : 110,
              fontFamily:  'Anton',
              lineHeight:  0.92,
              letterSpacing: -1,
            }}
          >
            {displayName}
          </span>
          <span
            style={{
              color:      MUTE,
              fontSize:   26,
              fontFamily: 'JetBrains Mono',
              marginTop:  16,
              letterSpacing: 1,
            }}
          >
            {trackTitle}
          </span>
        </div>

        {/* ── User row ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', marginTop: 40, marginBottom: 0 }}>
          <Rule opacity={0.25} />
        </div>

        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginTop:      24,
          }}
        >
          <span style={{ color: BONE, fontSize: 26, fontFamily: 'JetBrains Mono' }}>
            {handle}
          </span>
          {accuracy != null && (
            <span style={{ color: RISING, fontSize: 26, fontFamily: 'JetBrains Mono' }}>
              {Math.round(Number(accuracy) * 100)}% ACCURATE
            </span>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', marginTop: 32, marginBottom: 0 }}>
          <Rule opacity={0.15} />
        </div>

        <span
          style={{
            color:       MUTE,
            fontSize:    18,
            fontFamily:  'JetBrains Mono',
            letterSpacing: 5,
            marginTop:   20,
          }}
        >
          STREETS.NG
        </span>
      </div>
    ),
    {
      width:  W,
      height: H,
      fonts: [
        { name: 'Anton',          data: antonFont, style: 'normal', weight: 400 },
        { name: 'JetBrains Mono', data: monoFont,  style: 'normal', weight: 400 },
      ],
    },
  )
}
