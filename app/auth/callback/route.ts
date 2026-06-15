import { NextResponse }       from 'next/server'
import { createClient }       from '@/lib/supabase/server'

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── GET /auth/callback ───────────────────────────────────────────────────────
// Handles the redirect from Supabase OAuth (Google / X / email magic link).
// Exchanges the one-time code for a session, then sets the user's handle from
// OAuth metadata (if not already set), then redirects to the origin page.
//
// redirectTo must be whitelisted in:
//   Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
//   Add: http://localhost:3000/auth/callback  (dev)
//   Add: https://<your-vercel-url>/auth/callback  (prod)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const next      = searchParams.get('next') ?? '/'
  const wasUpgrade = searchParams.get('upgrade') === '1'

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session?.user) {
      const u = session.user

      // Set handle from OAuth metadata if not already set.
      // The auth trigger handle_new_auth_user does NOT set handles, so we do it here.
      if (!u.is_anonymous) {
        const rawName =
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          (u.email?.split('@')[0])

        if (rawName) {
          const baseSlug = toSlug(rawName)
          if (baseSlug) {
            // Try base slug; if unique-constraint fires, append a 4-char hex suffix
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sb = supabase as any
            const { error: updateErr } = await sb
              .from('users')
              .update({ handle: baseSlug })
              .eq('id', u.id)
              .is('handle', null) // only update if handle is not yet set

            if (updateErr?.code === '23505') {
              const suffix = Math.random().toString(16).slice(2, 6)
              await sb
                .from('users')
                .update({ handle: `${baseSlug}-${suffix}` })
                .eq('id', u.id)
                .is('handle', null)
            }
          }
        }
      }
    }
  }

  // Append ?upgraded=1 when this was an anonymous → permanent upgrade.
  // The UpgradeBanner in layout reads this param to show a success message.
  const separator = next.includes('?') ? '&' : '?'
  const redirectPath = wasUpgrade ? `${next}${separator}upgraded=1` : next

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
