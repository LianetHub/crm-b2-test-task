import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const output = execFileSync(
  process.execPath,
  [resolve('node_modules/supabase/dist/supabase.js'), 'gen', 'types', 'typescript', '--local'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
)
if (!output.includes('export type Database')) throw new Error('Unexpected type generator output')
writeFileSync('src/lib/database.generated.ts', output, 'utf8')
console.log('Generated src/lib/database.generated.ts')
