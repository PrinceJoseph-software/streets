import Image from 'next/image'

interface CoverImageProps {
  coverUrl: string | null | undefined
  artistName: string
  width: number
  height: number
  priority?: boolean
}

/** Returns true only for real Supabase Storage URLs — everything else uses the local fallback. */
function isSupabaseUrl(url: string | null | undefined): url is string {
  return Boolean(url && url.includes('.supabase.co/'))
}

/**
 * Cover art that never touches an external placeholder service.
 *
 * - Real Supabase Storage URL  → next/image (optimised, cached by Vercel)
 * - null / '' / placehold.co  → local ink box + artist initial (zero network)
 */
export function CoverImage({ coverUrl, artistName, width, height, priority }: CoverImageProps) {
  if (isSupabaseUrl(coverUrl)) {
    return (
      <Image
        src={coverUrl}
        alt={`${artistName} cover`}
        width={width}
        height={height}
        className="object-cover w-full h-full"
        priority={priority}
      />
    )
  }

  // Local fallback — zero network requests, matches ink/bone palette
  return (
    <div
      className="w-full h-full bg-ink relative"
      role="img"
      aria-label={`${artistName} cover`}
    >
      <span
        className="absolute bottom-1 left-1 font-mono text-xs leading-none select-none"
        style={{ color: '#F4F1EA' }}
        aria-hidden
      >
        {artistName.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
