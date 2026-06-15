'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'

// Fires PostHog 'share_card_view' when the artist page is reached via a share card link.
// Must be wrapped in <Suspense> in the parent (useSearchParams requirement).

export function ShareCardTracker({ artistSlug }: { artistSlug: string }) {
  const searchParams = useSearchParams()
  const posthog      = usePostHog()

  useEffect(() => {
    if (searchParams.get('src') === 'card') {
      posthog?.capture('share_card_view', { artist_slug: artistSlug })
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
