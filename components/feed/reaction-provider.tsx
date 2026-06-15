'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@/lib/supabase/client'

// ─── types ─────────────────────────────────────────────────────────────────────

type ReactionCounts = Record<string, number> // trackId → count

interface ReactionCtx {
  counts: ReactionCounts
  reactedIds: Set<string>
  react: (trackId: string) => Promise<void>
}

// ─── context ───────────────────────────────────────────────────────────────────

const Ctx = createContext<ReactionCtx>({
  counts: {},
  reactedIds: new Set(),
  react: async () => {},
})

export function useReactions() {
  return useContext(Ctx)
}

// ─── provider ──────────────────────────────────────────────────────────────────

interface Props {
  trackIds: string[]
  initialCounts: ReactionCounts
  children: React.ReactNode
}

export function ReactionProvider({ trackIds, initialCounts, children }: Props) {
  const posthog  = usePostHog()
  const supabase = createClient()
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts)
  // Track IDs the current session has reacted to (prevents Realtime double-counting own reactions)
  const locallyReacted = useRef<Set<string>>(new Set())
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set())

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (trackIds.length === 0) return

    const channel = supabase
      .channel('feed-reactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'engagement_events',
          // filter: only react events for tracks on this screen
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { track_id: string; kind: string }
          if (row.kind !== 'react') return
          if (!trackIds.includes(row.track_id)) return
          // Skip if this client is the one who sent it (optimistic already applied)
          if (locallyReacted.current.has(row.track_id)) {
            locallyReacted.current.delete(row.track_id)
            return
          }
          setCounts((prev) => ({
            ...prev,
            [row.track_id]: (prev[row.track_id] ?? 0) + 1,
          }))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [trackIds, supabase])

  // ── react handler (optimistic) ────────────────────────────────────────────
  const react = useCallback(
    async (trackId: string) => {
      // Optimistic
      locallyReacted.current.add(trackId)
      setCounts((prev) => ({
        ...prev,
        [trackId]: (prev[trackId] ?? 0) + 1,
      }))
      setReactedIds((prev) => new Set(prev).add(trackId))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('cast_reaction', {
        p_track_id: trackId,
      })

      if (!error) {
        posthog?.capture('react', { track_id: trackId })
        return
      }

      // Roll back on error
      locallyReacted.current.delete(trackId)
      setCounts((prev) => ({
        ...prev,
        [trackId]: Math.max((prev[trackId] ?? 1) - 1, 0),
      }))
      setReactedIds((prev) => {
        const next = new Set(prev)
        next.delete(trackId)
        return next
      })
    },
    [supabase, posthog],
  )

  return (
    <Ctx.Provider value={{ counts, reactedIds, react }}>
      {children}
    </Ctx.Provider>
  )
}
