'use client'

import { ReactionProvider } from './reaction-provider'
import { FeedSurface } from './feed-surface'
import type { RankRowTrack } from './rank-row'

interface Props {
  rising: RankRowTrack[]
  hottest: RankRowTrack[]
  fresh: RankRowTrack[]
  nigeria: RankRowTrack[]
  hiddenGems: RankRowTrack[]
  initialCounts: Record<string, number>
}

export function FeedClient({
  rising,
  hottest,
  fresh,
  nigeria,
  hiddenGems,
  initialCounts,
}: Props) {
  // Collect all track IDs visible on this screen for Realtime subscription
  const allTracks = [...rising, ...hottest, ...fresh, ...nigeria, ...hiddenGems]
  const trackIds = [...new Set(allTracks.map((i) => i.tracks.id))]

  return (
    <ReactionProvider trackIds={trackIds} initialCounts={initialCounts}>
      <FeedSurface
        label="Rising Now"
        subLabel="By momentum"
        items={rising}
        emptyMessage="Nothing rising yet — be first."
      />

      <FeedSurface
        label="Hottest Today"
        subLabel="Last 18h"
        items={hottest}
        emptyMessage="Check back later."
      />

      {fresh.length > 0 && (
        <FeedSurface
          label="Fresh"
          subLabel="Just dropped"
          items={fresh}
          emptyMessage="Nothing fresh right now."
        />
      )}

      {hiddenGems.length >= 2 && (
        <FeedSurface
          label="Hidden Gems"
          subLabel="Slept on"
          items={hiddenGems}
          emptyMessage=""
        />
      )}

      <FeedSurface
        label="Nigeria Underground"
        subLabel="All-time chart"
        items={nigeria}
        showCity
        emptyMessage="The chart is empty. Submit the first track."
      />
    </ReactionProvider>
  )
}
