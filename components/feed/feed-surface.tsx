import { RankRow, type RankRowTrack } from './rank-row'

interface Props {
  label: string
  subLabel?: string
  items: RankRowTrack[]
  emptyMessage?: string
  showCity?: boolean
}

export function FeedSurface({
  label,
  subLabel,
  items,
  emptyMessage = 'No tracks yet.',
  showCity = false,
}: Props) {
  return (
    <section className="mt-10">
      {/* Surface header */}
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display text-2xl text-ink uppercase tracking-wide">
          {label}
        </h2>
        {subLabel && (
          <span className="font-mono text-xs text-mute uppercase">{subLabel}</span>
        )}
      </div>
      <div className="w-full h-px bg-ink opacity-20 mb-0" />

      {/* Rows */}
      {items.length === 0 ? (
        <p className="font-mono text-xs text-mute uppercase tracking-widest py-6 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div>
          {items.map((item) => (
            <RankRow
              key={item.tracks.id}
              item={item}
              showCity={showCity}
            />
          ))}
        </div>
      )}
    </section>
  )
}
