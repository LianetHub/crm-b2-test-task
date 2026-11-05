import { PGlite } from '@electric-sql/pglite'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const users = {
  dispatcher: '00000000-0000-0000-0000-000000000001',
  dispatcher2: '00000000-0000-0000-0000-000000000002',
  executor: '00000000-0000-0000-0000-000000000003',
  executor2: '00000000-0000-0000-0000-000000000004',
  unassigned: '00000000-0000-0000-0000-000000000005',
}

export async function database() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  const dir = resolve('supabase/migrations')
  for (const file of (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(resolve(dir, file), 'utf8'))
  }
  return db
}

export async function seedProfiles(db: PGlite) {
  for (const [role, id] of Object.entries(users)) {
    await db.query('insert into auth.users (id) values ($1)', [id])
    if (role !== 'unassigned')
      await db.query('insert into public.profiles(id, display_name, role) values ($1,$2,$3)', [
        id,
        role,
        role.startsWith('dispatcher') ? 'dispatcher' : 'executor',
      ])
  }
}

export async function asUser<T = Record<string, unknown>>(
  db: PGlite,
  user: string | null,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`)
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ''])
    return (await tx.query<T>(sql, params)).rows
  })
}
