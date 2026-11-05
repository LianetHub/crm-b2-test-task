import { execFileSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const bin = resolve('node_modules/supabase/dist/supabase.js')
const raw = execFileSync(process.execPath, [bin, 'status', '--output', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
const status = JSON.parse(raw)
const url = status.API_URL ?? status.api_url
const anon = status.ANON_KEY ?? status.anon_key ?? status.PUBLISHABLE_KEY
const service = status.SERVICE_ROLE_KEY ?? status.service_role_key ?? status.SECRET_KEY
if (!url || !anon || !service)
  throw new Error('Local Supabase status does not include required connection fields')
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Expected local Supabase')
if (!existsSync('.env.local'))
  writeFileSync('.env.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anon}\n`)
writeFileSync(
  '.env.test',
  `TEST_SUPABASE_URL=${url}\nTEST_SUPABASE_ANON_KEY=${anon}\nTEST_SUPABASE_SERVICE_ROLE_KEY=${service}\n`,
)
console.log('Local app/test environment files configured. Existing .env.local preserved. No keys printed.')
