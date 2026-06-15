interface Props {
  currentRank: number | null
  /** Rank values oldest-first. Caller passes at minimum [currentRank] once ranked. */
  history: number[]
}

export function RankSparkline({ currentRank, history }: Props) {
  // ── Not yet ranked ────────────────────────────────────────────────────────
  if (currentRank === null) {
    return (
      <div className="mb-8">
        <p className="font-mono text-xs text-mute uppercase tracking-widest mb-2">
          Rank History · Nigeria Underground
        </p>
        <p className="font-mono text-sm text-ink">
          Not yet ranked — cast the first vote.
        </p>
      </div>
    )
  }

  // ── SVG sparkline ─────────────────────────────────────────────────────────
  const pts = history.length > 0 ? history : [currentRank]
  const min = Math.max(1, Math.min(...pts) - 1)
  const max = Math.max(...pts) + 1
  const range = max - min || 1

  const W = 120
  const H = 32

  // Invert Y: rank 1 = top of SVG (y=0)
  const svgPoints = pts
    .map((rank, i) => {
      const x = pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2
      const y = ((rank - min) / range) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="mb-8">
      <p className="font-mono text-xs text-mute uppercase tracking-widest mb-3">
        Rank History · Nigeria Underground
      </p>

      <div className="flex items-center gap-5">
        {/* Current rank — big mono */}
        <span className="font-mono text-5xl font-bold text-ink leading-none">
          #{currentRank}
        </span>

        {/* Sparkline SVG */}
        <div className="flex-1 flex flex-col gap-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            aria-hidden
            style={{ overflow: 'visible' }}
          >
            {pts.length > 1 ? (
              <polyline
                points={svgPoints}
                fill="none"
                stroke="#0a0a0a"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              /* Single dot — history begins here */
              <circle cx={W / 2} cy={H / 2} r="3" fill="#0a0a0a" />
            )}
          </svg>
          {pts.length <= 1 && (
            <p className="font-mono text-xs text-mute">
              History builds as votes roll in.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
