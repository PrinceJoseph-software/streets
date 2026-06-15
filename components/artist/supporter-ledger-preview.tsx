export interface SupporterRow {
  supporter_rank: number
  weeks_early: number
  users: { handle: string | null } | null
}

interface Props {
  isIgnited: boolean
  supporterCount: number
  voteCount: number
  supporters: SupporterRow[]
  nextSupporterNumber: number
}

export function SupporterLedgerPreview({
  isIgnited,
  supporterCount,
  voteCount,
  supporters,
  nextSupporterNumber,
}: Props) {
  // ── Section header ────────────────────────────────────────────────────────
  const sectionLabel = isIgnited ? 'Early Supporter Ledger' : 'Backers'

  return (
    <div>
      <p className="font-mono text-xs text-mute uppercase tracking-widest mb-3">
        {sectionLabel}
      </p>

      {/* ── Pre-ignition: vote count + prompt ──────────────────────────── */}
      {!isIgnited && (
        <>
          {voteCount === 0 ? (
            <p className="font-display text-3xl text-ink uppercase leading-tight mb-4">
              Nobody's backed this yet.<br />Be #1.
            </p>
          ) : (
            <p className="font-mono text-sm text-ink mb-4">
              <span className="font-mono text-2xl font-bold">{voteCount}</span>{' '}
              {voteCount === 1 ? 'person has' : 'people have'} backed this artist.
            </p>
          )}

          <p className="font-mono text-xs text-mute leading-relaxed">
            Back them before Ignition and earn a permanent spot on the ledger.
          </p>
        </>
      )}

      {/* ── Post-ignition: ledger rows ──────────────────────────────────── */}
      {isIgnited && (
        <>
          <p className="font-mono text-sm text-ink mb-4">
            <span className="font-mono text-2xl font-bold">{supporterCount}</span>{' '}
            early {supporterCount === 1 ? 'supporter' : 'supporters'} called it.
          </p>

          {supporters.length > 0 ? (
            <div>
              {/* Column headers */}
              <div className="flex items-center gap-3 pb-2 border-b border-ink border-opacity-20">
                <span className="font-mono text-xs text-mute w-8 text-right">#</span>
                <span className="font-mono text-xs text-mute flex-1">Handle</span>
                <span className="font-mono text-xs text-mute text-right">Wks early</span>
              </div>

              {supporters.map((s) => (
                <div
                  key={s.supporter_rank}
                  className="flex items-center gap-3 py-2.5 border-b border-ink border-opacity-10"
                >
                  <span className="font-mono text-sm font-bold text-ink w-8 text-right">
                    {s.supporter_rank}
                  </span>
                  <span className="font-body text-sm text-ink flex-1 truncate">
                    {s.users?.handle ?? 'anon'}
                  </span>
                  <span className="font-mono text-sm text-rising text-right">
                    +{s.weeks_early}w
                  </span>
                </div>
              ))}

              {supporterCount > supporters.length && (
                <p className="font-mono text-xs text-mute pt-3">
                  +{supporterCount - supporters.length} more backers
                </p>
              )}
            </div>
          ) : (
            <p className="font-mono text-xs text-mute">Ledger is being compiled.</p>
          )}

          <p className="font-mono text-xs text-mute mt-4">
            Ignited — ledger is sealed.
          </p>
        </>
      )}

      {/* ── "Be supporter #N" — shown pre-ignition when there are backers ── */}
      {!isIgnited && voteCount > 0 && (
        <p className="font-mono text-xs text-mute mt-4">
          Back now → be supporter #{nextSupporterNumber}
        </p>
      )}
    </div>
  )
}
