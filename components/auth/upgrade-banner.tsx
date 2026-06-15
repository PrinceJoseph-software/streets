'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/supabase/auth-provider'

// ─── UpgradeBanner ────────────────────────────────────────────────────────────
// Renders a temporary top banner after anonymous → permanent upgrade.
// Reads ?upgraded=1 from the URL (set by /auth/callback), fires PostHog event,
// then strips the param so it doesn't appear on refreshes.
//
// Must be wrapped in <Suspense> in the parent (uses useSearchParams).

export function UpgradeBanner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const posthog      = usePostHog()
  const { user }     = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return

    setShow(true)

    // Fire activation event
    posthog?.capture('auth_upgrade', {
      method: 'oauth_or_email',
      user_id: user?.id,
    })

    // Strip ?upgraded=1 from the URL without a full navigation
    const params = new URLSearchParams(searchParams.toString())
    params.delete('upgraded')
    const clean = params.size > 0 ? `${pathname}?${params}` : pathname
    router.replace(clean, { scroll: false })

    // Auto-hide after 5 seconds
    const t = setTimeout(() => setShow(false), 5000)
    return () => clearTimeout(t)
  // searchParams identity changes on every render in Next.js; use .toString() as dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  if (!show) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-ink text-bone py-3 px-5">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-widest">
          You're in — your reactions are saved. ✓
        </p>
        {user && !user.is_anonymous && (
          <a
            href={`/u/${user.id}`}
            className="font-mono text-xs text-streets-yellow uppercase tracking-widest flex-shrink-0"
          >
            View profile →
          </a>
        )}
      </div>
    </div>
  )
}
