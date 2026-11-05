import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { randomUUID } from 'node:crypto'

config({ path: '.env.test', quiet: true })
export const url = process.env.TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const publicKey = process.env.TEST_SUPABASE_ANON_KEY ?? ''
const adminKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? ''

export function testAdmin() {
  if (!publicKey || !adminKey)
    throw new Error('Run npm run db:start and node scripts/configure-local.mjs before API/E2E tests.')
  // Tests must never seed/delete users in a cloud/demo database accidentally.
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
    throw new Error('Tests require an isolated local Supabase instance')
  return createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function publicClient() {
  return createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function provision(admin: SupabaseClient, role: 'dispatcher' | 'executor' | null) {
  const password = `Crm!${randomUUID()}`
  const email = `test-${randomUUID()}@example.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('User not created')
  if (role) {
    const { error: profileError } = await admin.from('profiles').insert({
      id: data.user.id,
      role,
      display_name: role === 'dispatcher' ? 'Анна Смирнова' : 'Иван Петров',
    })
    if (profileError) throw profileError
  }
  const client = publicClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, email, password, client }
}

export async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}
