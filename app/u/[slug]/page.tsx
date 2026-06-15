import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'

// ─── helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function trustLabel(trust: number): string {
  if (trust >= 1.8) return 'Scout'
  if (trust >= 1.3) return 'Rising Scout'
  if (trust >= 1.0) return 'Early Believer'
  return 'New Voice'
}

function accuracyLabel(accuracy: number | null): string {
  if (accuracy === null) return '—'
  return `${Math.round(accuracy * 100)}%`
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()

  const query = UUID_RE.test(slug)
    ? supabase.from('users').select('handle, taste_trust').eq('id', slug).maybeSingle()
    : supabase.from('users').select('handle, taste_trust').eq('handle', slug).maybeSingle()

  const { data } = await query

  if (!data) return { title: 'Streets' }

  const displayName = (data as { handle: string | null; taste_trust: number }).handle ?? 'Tastemaker'
  const trust       = (data as { handle: string | null; taste_trust: number }).taste_trust ?? 1.0

  return {
    title: `${displayName} — ${trustLabel(trust)} · Streets`,
    description: `${displayName}'s early-backer ledger on Streets Underground.`,
  }
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function TastemakerProfile({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  // Resolve by UUID or handle
  const userQuery = UUID_RE.test(slug)
    ? supabase
        .from('users')
        .select('id, handle, is_anonymous, taste_trust, accuracy, created_at')
        .eq('id', slug)
        .maybeSingle()
    : supabase
        .from('users')
        .select('id, handle, is_anonymous, taste_trust, accuracy, created_at')
        .eq('handle', slug)
        .maybeSingle()

  const { data: rawUser } = await userQuery
  if (!rawUser) notFound()

  const user = rawUser as {
    id: string
    handle: string | null
    is_anonymous: boolean
    taste_trust: number
    accuracy: number | null
    created_at: string
  }

  if (user.is_anonymous) notFound() // anonymous profiles are not public

  // Supporter ledger for this user, joined with artist info
  const { data: rawLedger } = await supabase
    .from('supporter_ledger')
    .select('supporter_rank, weeks_early, created_at, artists(id, name, slug, ignited_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const ledger = (rawLedger ?? []) as unknown as Array<{
    supporter_rank: number
    weeks_early: number
    created_at: string
    artists: { id: string; name: string; slug: string; ignited_at: string } | null
  }>

  const displayName = user.handle ?? 'Tastemaker'
  const badge       = trustLabel(user.taste_trust)
  const joined      = new Date(user.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <main className="min-h-dvh bg-bone pb-24">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-5 pt-6 flex items-center justify-between">
        <a href="/" className="font-mono text-xs text-mute uppercase tracking-widest">
          ← Streets
        </a>
        <a href="/" className="font-display text-base text-ink uppercase tracking-widest">
          STREETS
        </a>
      </div>

      {/* ── Profile header ──────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-5 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <h1 className="font-display text-5xl text-ink uppercase leading-none">
            {displayName}
          </h1>
          {/* Badge — ink on bone with border, NOT yellow (yellow is the CTA elsewhere) */}
          <span className="font-mono text-xs text-ink uppercase tracking-widest border border-ink px-2 py-1 mt-1 flex-shrink-0">
            {badge}
          </span>
        </div>

        <p className="font-mono text-xs text-mute uppercase tracking-widest mt-3">
          Joined {joined}
        </p>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-ink opacity-20 mt-6 mb-5" />

        <div className="flex gap-10">
          <div>
            <p className="font-mono text-3xl font-bold text-ink leading-none">
              {accuracyLabel(user.accuracy)}
            </p>
            <p className="font-mono text-xs text-mute uppercase tracking-widest mt-1">
              Accuracy
            </p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold text-ink leading-none">
              {ledger.length}
            </p>
            <p className="font-mono text-xs text-mute uppercase tracking-widest mt-1">
              {ledger.length === 1 ? 'Early call' : 'Early calls'}
            </p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold text-ink leading-none">
              {user.taste_trust.toFixed(1)}
            </p>
            <p className="font-mono text-xs text-mute uppercase tracking-widest mt-1">
              Trust
            </p>
          </div>
        </div>

        <div className="w-full h-px bg-ink opacity-20 mt-6" />
      </div>

      {/* ── Early Supporter Ledger ──────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-5">
        <p className="font-mono text-xs text-mute uppercase tracking-widest mb-4">
          Early Supporter Ledger
        </p>

        {ledger.length === 0 ? (
          <div>
            <p className="font-display text-3xl text-ink uppercase leading-tight mb-3">
              No calls yet.
            </p>
            <p className="font-mono text-xs text-mute">
              Back artists before they ignite to earn your spot.
            </p>
          </div>
        ) : (
          <div>
            {ledger.map((entry, i) => (
              <LedgerRow key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

// ─── LedgerRow ────────────────────────────────────────────────────────────────

function LedgerRow({
  entry,
}: {
  entry: {
    supporter_rank: number
    weeks_early: number
    artists: { name: string; slug: string; ignited_at: string } | null
  }
}) {
  if (!entry.artists) return null

  return (
    <a
      href={`/a/${entry.artists.slug}`}
      className="flex items-center gap-4 py-4 border-b border-ink border-opacity-10 hover:border-opacity-30 transition-colors group"
    >
      {/* Supporter rank */}
      <span className="font-mono text-2xl font-bold text-ink leading-none w-10 flex-shrink-0">
        #{entry.supporter_rank}
      </span>

      {/* Artist info */}
      <div className="flex-1 min-w-0">
        <p className="font-display text-xl text-ink uppercase leading-tight truncate group-hover:underline">
          {entry.artists.name}
        </p>
        <p className="font-mono text-xs text-mute mt-0.5">
          Backed before Ignition
        </p>
      </div>

      {/* Weeks early — the hero number */}
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-xl font-bold text-rising leading-none">
          +{entry.weeks_early}w
        </p>
        <p className="font-mono text-xs text-mute mt-0.5">
          early
        </p>
      </div>
    </a>
  )
}
