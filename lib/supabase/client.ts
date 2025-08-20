import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Creates a browser Supabase client using anon key
// Never imports server-only modules
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient<Database>(url, anonKey)
}
