'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// ─── context ──────────────────────────────────────────────────────────────────

interface AuthCtx {
  user: User | null
  isAnonymous: boolean
  isLoading: boolean
}

const Ctx = createContext<AuthCtx>({
  user: null,
  isAnonymous: true,
  isLoading: true,
})

export function useAuth() {
  return useContext(Ctx)
}

// ─── provider ──────────────────────────────────────────────────────────────────
// On first visit: silently creates an anonymous Supabase session (taste_trust 0.2).
// The anonymous session persists in localStorage across visits.
// When the user upgrades via OAuth/email, the same UUID is kept — history preserved.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Listen for all auth state changes (login, logout, upgrade)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      },
    )

    // Bootstrap: restore existing session or create an anonymous one
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setLoading(false)
      } else {
        // No session — silently create anonymous identity
        // Supabase trigger handle_new_auth_user sets taste_trust = 0.2
        await supabase.auth.signInAnonymously()
        // onAuthStateChange above will pick up the new session
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider value={{ user, isAnonymous: user?.is_anonymous ?? true, isLoading }}>
      {children}
    </Ctx.Provider>
  )
}
