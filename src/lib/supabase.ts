import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.generated'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const isConfigured = Boolean(url && key && key !== 'replace-with-local-anon-or-cloud-publishable-key')
export const supabase = createClient<Database>(
  url || 'http://127.0.0.1:54321',
  key || 'configuration-missing',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  },
)
