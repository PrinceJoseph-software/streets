import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { SubmitForm } from '@/components/submit/submit-form'

export const metadata: Metadata = {
  title: 'Submit a Track — Streets',
  description: 'Put an artist on the streets. Submit a track and let the community rank it.',
}

export default async function SubmitPage() {
  const supabase = createPublicClient()

  // Pre-load lookup data server-side — no client fetch needed
  const [{ data: genres }, { data: cities }] = await Promise.all([
    supabase.from('genres').select('id, name, slug').order('name'),
    supabase.from('cities').select('id, name, slug').order('name'),
  ])

  return (
    <main className="min-h-dvh bg-bone px-5 pb-20">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto pt-10 pb-6">
        <a
          href="/"
          className="font-display text-xl text-ink uppercase tracking-widest block mb-8"
        >
          STREETS
        </a>

        <h1 className="font-display text-5xl text-ink uppercase leading-none">
          Submit<br />a track.
        </h1>

        {/* One rule under the headline */}
        <div className="w-full h-px bg-ink mt-6 opacity-20" />

        <p className="font-mono text-xs text-mute uppercase tracking-widest mt-4">
          First on the streets wins.
        </p>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <SubmitForm
        genres={genres ?? []}
        cities={cities ?? []}
      />
    </main>
  )
}
