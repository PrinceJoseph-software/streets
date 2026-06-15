import { ImageResponse } from 'next/og'
import { createPublicClient } from '@/lib/supabase/public'
import { antonFont, monoFont } from '@/lib/og-fonts'

export const runtime = 'nodejs'

const W = 1080
const H = 1350
const PAD = 80

// ─── helpers ──────────────────────────────────────────────────────────────────
const INK    = '#0A0A0A'
const BONE   = '#F4F1EA'
const YELLOW = '#FFE000'
const RISING = '#1FAE6B'
const MUTE   = '#8A857A'

function Rule({ color = BONE, opacity = 1 }: { color?: string; opacity?: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: 2,
        backgroundColor: color,
        opacity,
        flexShrink: 0,
      }}
    />
  )
}

// ─── route handler ────────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params
  const supabase = createPublicClient()

  // 1. Core track + artist + city + genre
  const { data: track } = await supabase
    .from('tracks')
    .select('title, artist_id, artists(name, ignited_at), cities(name), genres(name)')
    .eq('id', trackId)
    .single()

  if (!track) {
    return new Response('Track not found', { status: 404 })
  }

  // Supabase returns FK objects as an array when there might be multiple,
  // or as a single object for !inner joins — coerce safely.
  const artist     = Array.isArray(track.artists)  ? track.artists[0]  : track.artists
  const city       = Array.isArray(track.cities)   ? track.cities[0]   : track.cities
  const genre      = Array.isArray(track.genres)   ? track.genres[0]   : track.genres
  const artistName = (artist?.name ?? 'UNKNOWN').toUpperCase()
  const trackTitle = track.title
  const cityName   = (city?.name   ?? '').toUpperCase()
  const genreName  = (genre?.name  ?? '').toUpperCase()

  // 2. National ranking
  const { data: ranking } = await supabase
    .from('rankings')
    .select('rank, momentum')
    .eq('track_id', trackId)
    .eq('bucket', 'nigeria')
    .maybeSingle()

  const rank     = ranking?.rank     ?? null
  const momentum = ranking?.momentum ?? 0

  // 3. Backer count
  const { count: backerCount } = await supabase
    .from('supporter_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('artist_id', track.artist_id)

  // 4. Engagements in the last 7 days (the "▲ N this week" stat)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: weeklyCount } = await supabase
    .from('engagement_events')
    .select('*', { count: 'exact', head: true })
    .eq('track_id', trackId)
    .gte('created_at', since)

  const rankDisplay    = rank != null ? `#${rank}` : '—'
  const weeklyDisplay  = weeklyCount ?? 0
  const backerDisplay  = backerCount ?? 0

  // Truncate long artist names so they fit at large size
  const displayName = artistName.length > 14
    ? artistName.slice(0, 13) + '…'
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
        {/* ── Top bar: wordmark + location ─────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: BONE, fontSize: 32, fontFamily: 'Anton', letterSpacing: 6 }}>
            STREETS
          </span>
          <span style={{ color: MUTE, fontSize: 18, fontFamily: 'JetBrains Mono', letterSpacing: 3 }}>
            {[cityName, genreName].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div style={{ marginTop: 40, marginBottom: 0, display: 'flex' }}>
          <Rule />
        </div>

        {/* ── Artist name + track title ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 56 }}>
          <span
            style={{
              color:       BONE,
              fontSize:    displayName.length > 10 ? 110 : 140,
              fontFamily:  'Anton',
              lineHeight:  0.92,
              letterSpacing: -2,
            }}
          >
            {displayName}
          </span>
          <span
            style={{
              color:      MUTE,
              fontSize:   28,
              fontFamily: 'JetBrains Mono',
              marginTop:  20,
              letterSpacing: 1,
            }}
          >
            {trackTitle}
          </span>
        </div>

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex' }} />

        {/* ── HERO: rank number — THE ONE YELLOW ELEMENT ───────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div
            style={{
              backgroundColor: YELLOW,
              padding:         '20px 48px',
              display:         'flex',
              alignItems:      'center',
            }}
          >
            <span
              style={{
                color:      INK,       // ink on yellow — AA contrast
                fontSize:   rankDisplay.length > 3 ? 160 : 200,
                fontFamily: 'JetBrains Mono',
                lineHeight: 1,
                fontWeight: 400,
              }}
            >
              {rankDisplay}
            </span>
          </div>
          <span
            style={{
              color:       MUTE,
              fontSize:    18,
              fontFamily:  'JetBrains Mono',
              marginTop:   14,
              letterSpacing: 4,
            }}
          >
            UNDERGROUND RANK · NIGERIA
          </span>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', marginTop: 56, marginBottom: 0 }}>
          <Rule color={RISING} />
        </div>

        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginTop:      32,
          }}
        >
          {/* Weekly movement */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: RISING, fontSize: 36, fontFamily: 'JetBrains Mono', marginRight: 12 }}>
              ▲
            </span>
            <span style={{ color: BONE, fontSize: 36, fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              {weeklyDisplay} THIS WEEK
            </span>
          </div>
          {/* Backer count */}
          <span style={{ color: BONE, fontSize: 36, fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            {backerDisplay} BACKERS
          </span>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', marginTop: 40, marginBottom: 0 }}>
          <Rule opacity={0.25} />
        </div>

        <span
          style={{
            color:       MUTE,
            fontSize:    18,
            fontFamily:  'JetBrains Mono',
            letterSpacing: 5,
            marginTop:   24,
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
