'use server'

import { createClient } from '@/lib/supabase/server'

// ─── types ────────────────────────────────────────────────────────────────────
export type SubmitTrackInput = {
  artistName:  string
  trackTitle:  string
  genreId:     string
  cityId:      string
  extUrl:      string
  extPlatform: string
  coverUrl:    string
  pitch:       string
}

export type SubmitTrackResult =
  | { success: true;  artistSlug: string; trackId: string }
  | { success: false; error: string }

// ─── helpers ──────────────────────────────────────────────────────────────────
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const PLATFORM_PATTERNS: Record<string, RegExp> = {
  audiomack: /audiomack\.com/i,
  spotify:   /open\.spotify\.com|spotify\.com/i,
  youtube:   /youtube\.com|youtu\.be/i,
  soundcloud:/soundcloud\.com/i,
}

function detectPlatform(url: string): string | null {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform
  }
  return null
}

// ─── action ───────────────────────────────────────────────────────────────────
export async function submitTrack(
  input: SubmitTrackInput,
): Promise<SubmitTrackResult> {
  const supabase = await createClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in to submit.' }
  }
  if (user.is_anonymous) {
    return {
      success: false,
      error: 'Create a permanent account to submit tracks.',
    }
  }

  // ── Server-side validation ───────────────────────────────────────────────────
  const artistName = input.artistName.trim()
  const trackTitle = input.trackTitle.trim()
  const pitch      = input.pitch.trim()

  if (!artistName || artistName.length > 60) {
    return { success: false, error: 'Artist name must be 1–60 characters.' }
  }
  if (!trackTitle || trackTitle.length > 100) {
    return { success: false, error: 'Track title must be 1–100 characters.' }
  }
  if (!input.genreId) {
    return { success: false, error: 'Select a genre.' }
  }
  if (!input.cityId) {
    return { success: false, error: 'Select a city.' }
  }
  if (!input.coverUrl) {
    return { success: false, error: 'Cover image is required.' }
  }
  if (pitch.length > 280) {
    return { success: false, error: 'Pitch must be 280 characters or fewer.' }
  }

  // Validate URL is a supported platform
  let validUrl: URL
  try {
    validUrl = new URL(input.extUrl)
  } catch {
    return { success: false, error: 'Paste a valid link from Audiomack, Spotify, YouTube, or SoundCloud.' }
  }
  const platform = detectPlatform(validUrl.href)
  if (!platform) {
    return {
      success: false,
      error: 'Only Audiomack, Spotify, YouTube, and SoundCloud links are supported.',
    }
  }

  // ── Artist: upsert by slug ───────────────────────────────────────────────────
  const slug = toSlug(artistName)
  if (!slug) {
    return { success: false, error: 'Artist name produced an invalid URL slug.' }
  }

  // Check for existing artist with this slug
  const { data: existing } = await supabase
    .from('artists')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  let artistId: string
  let artistSlug: string

  if (existing) {
    artistId   = existing.id
    artistSlug = existing.slug
  } else {
    const { data: newArtist, error: insertErr } = await supabase
      .from('artists')
      .insert({ slug, name: artistName, city_id: input.cityId })
      .select('id, slug')
      .single()

    if (insertErr || !newArtist) {
      return { success: false, error: 'Failed to create artist. Try again.' }
    }
    artistId   = newArtist.id
    artistSlug = newArtist.slug
  }

  // ── Track: insert ────────────────────────────────────────────────────────────
  const { data: newTrack, error: trackErr } = await supabase
    .from('tracks')
    .insert({
      artist_id:    artistId,
      title:        trackTitle,
      genre_id:     input.genreId,
      city_id:      input.cityId,
      ext_url:      validUrl.href,
      ext_platform: platform,
      cover_url:    input.coverUrl,
      pitch:        pitch || null,
    })
    .select('id')
    .single()

  if (trackErr || !newTrack) {
    return { success: false, error: 'Failed to save track. Try again.' }
  }

  return { success: true, artistSlug, trackId: newTrack.id }
}
