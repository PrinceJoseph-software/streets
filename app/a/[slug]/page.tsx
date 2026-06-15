import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { notFound }      from 'next/navigation'
import { createPublicClient }       from '@/lib/supabase/public'
import { ArtistVoteIsland }         from '@/components/artist/artist-vote-island'
import { ShareCardTracker }         from '@/components/artist/share-card-tracker'
import type { SupporterRow }        from '@/components/artist/supporter-ledger-preview'

// ─── ISR — matches the pg_cron interval ──────────────────────────────────────
export const revalidate = 180

// ─── helpers ──────────────────────────────────────────────────────────────────

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL)           return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// ─── SSG — pre-build all known artist slugs ───────────────────────────────────

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase.from('artists').select('slug')
  return (data ?? []).map((a) => ({ slug: a.slug }))
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()

  if (!artist) return { title: 'Streets' }

  // Top track for OG card
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id')
    .eq('artist_id', artist.id)

  const trackIds = (tracks ?? []).map((t) => t.id)
  let topTrackId: string | null = null

  if (trackIds.length > 0) {
    const { data: best } = await supabase
      .from('rankings')
      .select('track_id')
      .eq('bucket', 'nigeria')
      .in('track_id', trackIds)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle()
    topTrackId = (best as { track_id: string } | null)?.track_id ?? trackIds[0]
  }

  const base        = siteUrl()
  const title       = `${artist.name} — Streets Underground`
  const description = `${artist.name} is building a reputation on the underground. Back them early on Streets.`
  const ogImageUrl  = topTrackId ? `${base}/api/card/artist/${topTrackId}` : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${base}/a/${slug}`,
      siteName: 'Streets',
      ...(ogImageUrl && {
        images: [
          { url: ogImageUrl, width: 1080, height: 1350, alt: `${artist.name} rank card` },
        ],
      }),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImageUrl && { images: [ogImageUrl] }),
    },
  }
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  // 1. Artist + city
  const { data: rawArtist } = await supabase
    .from('artists')
    .select('id, name, slug, ignited_at, cities(name)')
    .eq('slug', slug)
    .maybeSingle()

  if (!rawArtist) notFound()

  // coerce FK join (placeholder Database type returns never for joins)
  const artist = rawArtist as unknown as {
    id: string
    name: string
    slug: string
    ignited_at: string | null
    cities: { name: string } | null
  }

  // 2. All tracks for this artist
  const { data: rawTracks } = await supabase
    .from('tracks')
    .select('id, title, cover_url, ext_url, ext_platform, genres(name)')
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })

  const tracks = (rawTracks ?? []) as unknown as Array<{
    id: string
    title: string
    cover_url: string
    ext_url: string
    ext_platform: string
    genres: { name: string } | null
  }>

  const trackIds = tracks.map((t) => t.id)

  // 3. Best nigeria ranking across all artist tracks
  let topTrack: (typeof tracks)[0] | null = null
  let ranking: { rank: number; momentum: number; pulse: number } | null = null

  if (trackIds.length > 0) {
    const { data: rawRanking } = await supabase
      .from('rankings')
      .select('track_id, rank, momentum, pulse')
      .eq('bucket', 'nigeria')
      .in('track_id', trackIds)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle()

    const bestRanking = rawRanking as unknown as {
      track_id: string
      rank: number
      momentum: number
      pulse: number
    } | null

    if (bestRanking) {
      topTrack = tracks.find((t) => t.id === bestRanking.track_id) ?? tracks[0]
      ranking = {
        rank:     bestRanking.rank,
        momentum: bestRanking.momentum,
        pulse:    bestRanking.pulse,
      }
    } else {
      topTrack = tracks[0] ?? null
    }
  }

  // 4. Supporter ledger + vote count (parallel)
  const nullTrackId = '00000000-0000-0000-0000-000000000000'
  const safeTrackIds = trackIds.length > 0 ? trackIds : [nullTrackId]

  const [
    { count: supporterCount },
    { data: rawSupporters },
    { count: voteCount },
  ] = await Promise.all([
    supabase
      .from('supporter_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artist.id),

    supabase
      .from('supporter_ledger')
      .select('supporter_rank, weeks_early, users(handle)')
      .eq('artist_id', artist.id)
      .order('supporter_rank', { ascending: true })
      .limit(5),

    supabase
      .from('engagement_events')
      .select('id', { count: 'exact', head: true })
      .in('track_id', safeTrackIds)
      .eq('kind', 'vote'),
  ])

  const supporters = (rawSupporters ?? []) as unknown as SupporterRow[]
  const cityName   = artist.cities?.name ?? ''

  return (
    <main className="min-h-dvh bg-bone pb-24">
      {/* ── Share card view tracker (fires PostHog when src=card) ─────── */}
      <Suspense>
        <ShareCardTracker artistSlug={artist.slug} />
      </Suspense>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-5 pt-6 flex items-center justify-between">
        <a
          href="/"
          className="font-mono text-xs text-mute uppercase tracking-widest"
        >
          ← Streets
        </a>
        <a
          href="/"
          className="font-display text-base text-ink uppercase tracking-widest"
        >
          STREETS
        </a>
      </div>

      {/* ── Vote island: hero + sparkline + live backers/sealed ledger ─── */}
      <div className="max-w-md mx-auto px-5">
        <ArtistVoteIsland
          artist={{
            id:        artist.id,
            name:      artist.name,
            slug:      artist.slug,
            city:      cityName,
            ignitedAt: artist.ignited_at,
          }}
          topTrack={
            topTrack
              ? {
                  id:          topTrack.id,
                  title:       topTrack.title,
                  coverUrl:    topTrack.cover_url,
                  extUrl:      topTrack.ext_url,
                  extPlatform: topTrack.ext_platform,
                  genre:       topTrack.genres?.name ?? '',
                }
              : null
          }
          ranking={ranking}
          isIgnited={!!artist.ignited_at}
          initialBackerCount={voteCount ?? 0}
          supporterCount={supporterCount ?? 0}
          supporters={supporters}
        />
      </div>
    </main>
  )
}
