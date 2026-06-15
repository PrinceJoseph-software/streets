import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Anon-key Supabase client for public data reads.
 * No cookies/session needed — used in OG image routes, generateMetadata,
 * and anywhere we read public data without needing the caller's identity.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
