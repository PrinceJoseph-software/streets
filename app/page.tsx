import { createPublicClient } from '@/lib/supabase/public'
import { FeedClient } from '@/components/feed/feed-client'
import type { RankRowTrack } from '@/components/feed/rank-row'

const TRACK_FIELDS = `
  rank,
  momentum,
  pulse,
  tracks (
    id,
    title,
    cover_url,
    ext_url,
    ext_platform,
    artists ( name, slug, ignited_at ),
    cities  ( name )
  )
` as const

export const revalidate = 60 // revalidate at most every 60s

export default async function Home() {
  const supabase = createPublicClient()

  const [risingRes, hottestRes, freshRes, nigeriaRes] = await Promise.all([
    supabase
      .from('rankings')
      .select(TRACK_FIELDS)
      .eq('bucket', 'rising')
      .order('rank')
      .limit(8),
    supabase
      .from('rankings')
      .select(TRACK_FIELDS)
      .eq('bucket', 'hottest')
      .order('rank')
      .limit(8),
    supabase
      .from('rankings')
      .select(TRACK_FIELDS)
      .eq('bucket', 'fresh')
      .order('rank')
      .limit(8),
    supabase
      .from('rankings')
      .select(TRACK_FIELDS)
      .eq('bucket', 'nigeria')
      .order('rank')
      .limit(20),
  ])

  const rising  = (risingRes.data  ?? []) as unknown as RankRowTrack[]
  const hottest = (hottestRes.data ?? []) as unknown as RankRowTrack[]
  const fresh   = (freshRes.data   ?? []) as unknown as RankRowTrack[]
  const nigeria = (nigeriaRes.data ?? []) as unknown as RankRowTrack[]

  // Hidden Gems: unignited, ranked 4th or below in nigeria chart
  const hiddenGems = nigeria.filter(
    (item) => !item.tracks.artists.ignited_at && item.rank >= 4,
  ).slice(0, 5)

  // Gather all track IDs for reaction counts
  const allItems = [...rising, ...hottest, ...fresh, ...nigeria, ...hiddenGems]
  const trackIds = [...new Set(allItems.map((i) => i.tracks.id))]

  // Fetch aggregate reaction counts in one query
  type ReactionRow = { track_id: string; count: number }
  const { data: reactionRows } = await supabase
    .from('engagement_events')
    .select('track_id, count:id.count()')
    .eq('kind', 'react')
    .in('track_id', trackIds.length > 0 ? trackIds : ['00000000-0000-0000-0000-000000000000'])

  const initialCounts: Record<string, number> = {}
  for (const row of (reactionRows ?? []) as unknown as ReactionRow[]) {
    initialCounts[row.track_id] = row.count
  }

  return (
    <main className="min-h-dvh bg-bone px-5 pb-24">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto pt-10 pb-2 flex items-center justify-between">
        <span className="font-display text-2xl text-ink uppercase tracking-widest">
          STREETS
        </span>
        <a
          href="/submit"
          className="font-mono text-xs text-ink uppercase tracking-widest border border-ink px-3 py-1.5 hover:bg-ink hover:text-bone transition-colors"
        >
          + Submit
        </a>
      </div>

      {/* ── Feed ───────────────────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto">
        <FeedClient
          rising={rising}
          hottest={hottest}
          fresh={fresh}
          nigeria={nigeria}
          hiddenGems={hiddenGems}
          initialCounts={initialCounts}
        />
      </div>
    </main>
  )
}
