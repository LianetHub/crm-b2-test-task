import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, database, seedProfiles, users } from './harness'

let db: PGlite
let project: string
let task: string
beforeAll(async () => {
  db = await database()
})
afterAll(async () => {
  await db?.close()
})

describe('database authorization and audit', () => {
  it('provides the four RLS-protected tables', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
    )
    expect(rows).toEqual(
      ['profiles', 'projects', 'task_status_history', 'tasks'].map((relname) => ({
        relname,
        relrowsecurity: true,
      })),
    )
    await seedProfiles(db)
  })
  it('creates a new task with database-owned author and history', async () => {
    const projects = await asUser<{ id: string }>(
      db,
      users.dispatcher,
      "select * from public.create_project('Северный','Ул. Строителей, 5')",
    )
    project = projects[0].id
    const tasks = await asUser<{ id: string; status: string; author_id: string }>(
      db,
      users.dispatcher,
      "select * from public.create_task('Проверить фундамент','',$1,$2)",
      [project, users.executor],
    )
    task = tasks[0].id
    expect(tasks[0]).toMatchObject({ status: 'new', author_id: users.dispatcher })
    const history = await asUser(
      db,
      users.executor,
      'select * from public.task_status_history where task_id=$1',
      [task],
    )
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ from_status: null, to_status: 'new', actor_id: users.dispatcher })
  })
  it('isolates tasks, projects, profiles and history across executors', async () => {
    for (const table of ['tasks', 'projects', 'task_status_history']) {
      expect(await asUser(db, users.executor2, `select * from public.${table}`)).toEqual([])
      expect((await asUser(db, users.executor, `select * from public.${table}`)).length).toBeGreaterThan(0)
      expect((await asUser(db, users.dispatcher2, `select * from public.${table}`)).length).toBeGreaterThan(0)
    }
    expect(await asUser(db, users.executor, 'select id from public.profiles')).toEqual([
      { id: users.executor },
    ])
    for (const table of ['tasks', 'projects', 'task_status_history']) {
      expect(await asUser(db, users.unassigned, `select * from public.${table}`)).toEqual([])
      await expect(asUser(db, null, `select * from public.${table}`)).rejects.toThrow()
    }
  })
  it('denies direct writes, forged authors, role escalation and audit tampering', async () => {
    for (const user of [users.executor, users.dispatcher, users.unassigned]) {
      const statements = [
        "update public.tasks set status='accepted'",
        'update public.tasks set author_id=gen_random_uuid()',
        "update public.profiles set role='dispatcher'",
        'delete from public.task_status_history',
        'update public.task_status_history set actor_id=gen_random_uuid()',
        "insert into public.projects(name,address) values ('x','y')",
        'delete from public.tasks',
        `insert into public.task_status_history(task_id,actor_id,actor_name,to_status) values ('${task}','${user}','fake','accepted')`,
      ]
      for (const sql of statements) await expect(asUser(db, user, sql)).rejects.toThrow(/permission denied/)
    }
    await expect(asUser(db, users.executor, "select public.create_project('x','y')")).rejects.toThrow()
    await expect(asUser(db, users.unassigned, "select public.create_project('x','y')")).rejects.toThrow()
    await expect(asUser(db, null, "select public.create_project('x','y')")).rejects.toThrow()
  })
  it('rejects foreign-task writes and dispatcher-only mutations by executor', async () => {
    await expect(
      asUser(db, users.executor2, "select public.change_task_status($1,'new','in_progress',null)", [task]),
    ).rejects.toThrow()
    await expect(
      asUser(db, users.executor, "select public.update_task($1,'fake','',$2,$3,1)", [
        task,
        project,
        users.executor,
      ]),
    ).rejects.toThrow()
    await expect(asUser(db, users.executor, 'select public.delete_task($1)', [task])).rejects.toThrow()
    await expect(asUser(db, users.executor, 'select public.delete_project($1)', [project])).rejects.toThrow()
  })
  it('validates all status/role combinations and preserves history on failure', async () => {
    const statuses = ['new', 'in_progress', 'review', 'accepted', 'rework']
    for (const from of statuses)
      for (const to of statuses)
        for (const user of [users.dispatcher, users.executor]) {
          await db.query('update public.tasks set status=$1 where id=$2', [from, task])
          const allowed =
            user === users.dispatcher
              ? from === 'review' && ['accepted', 'rework'].includes(to)
              : (['new', 'rework'].includes(from) && to === 'in_progress') ||
                (from === 'in_progress' && to === 'review')
          const previous = (
            await db.query<{ count: number }>('select count(*)::int as count from public.task_status_history')
          ).rows[0].count
          const action = asUser(db, user, 'select public.change_task_status($1,$2,$3,$4)', [
            task,
            from,
            to,
            'Комментарий',
          ])
          if (allowed) await expect(action).resolves.toBeDefined()
          else await expect(action).rejects.toThrow()
          const current = (
            await db.query<{ count: number }>('select count(*)::int as count from public.task_status_history')
          ).rows[0].count
          expect(current).toBe(previous + (allowed ? 1 : 0))
        }
  })
  it('requires a meaningful rework comment and detects stale status', async () => {
    await db.query("update public.tasks set status='review' where id=$1", [task])
    for (const comment of [null, '', '  ', '\n\t']) {
      await expect(
        asUser(db, users.dispatcher, "select public.change_task_status($1,'review','rework',$2)", [
          task,
          comment,
        ]),
      ).rejects.toThrow()
    }
    await expect(
      asUser(db, users.dispatcher, "select public.change_task_status($1,'new','accepted','ok')", [task]),
    ).rejects.toThrow(/STALE_STATUS/)
    await asUser(db, users.dispatcher, "select public.change_task_status($1,'review','accepted',null)", [
      task,
    ])
    await expect(
      asUser(db, users.dispatcher, "select public.change_task_status($1,'review','accepted',null)", [task]),
    ).rejects.toThrow()
  })
  it('reassignment preserves status and transfers all access immediately', async () => {
    const [{ revision }] = await asUser<{ revision: number }>(
      db,
      users.dispatcher2,
      'select revision from public.tasks where id=$1',
      [task],
    )
    await asUser(
      db,
      users.dispatcher2,
      "select public.update_task($1,'Новое название','Описание',$2,$3,$4)",
      [task, project, users.executor2, revision],
    )
    expect(await asUser(db, users.executor, 'select * from public.tasks')).toEqual([])
    expect(await asUser(db, users.executor, 'select * from public.projects')).toEqual([])
    expect(await asUser(db, users.executor, 'select * from public.task_status_history')).toEqual([])
    expect((await asUser(db, users.executor2, 'select status from public.tasks'))[0]).toEqual({
      status: 'accepted',
    })
    expect(
      (await asUser(db, users.executor2, 'select * from public.task_status_history')).length,
    ).toBeGreaterThan(1)
  })
  it('rejects whitespace, invalid executors and immutable field parameters', async () => {
    await expect(asUser(db, users.dispatcher, "select public.create_project(E' \n\t','x')")).rejects.toThrow()
    await expect(
      asUser(db, users.dispatcher, "select public.create_task('x','',$1,$2)", [project, users.dispatcher]),
    ).rejects.toThrow()
    await expect(
      asUser(db, users.dispatcher, "select public.update_task($1,'x','',$2,$3,1,author_id := $3)", [
        task,
        project,
        users.executor,
      ]),
    ).rejects.toThrow()
  })
  it('soft-deletes a project and its tasks without destroying history', async () => {
    const before = (await db.query('select * from public.task_status_history')).rows
    await asUser(db, users.dispatcher, 'select public.delete_project($1)', [project])
    for (const user of [users.dispatcher, users.executor2])
      for (const table of ['projects', 'tasks', 'task_status_history']) {
        expect(await asUser(db, user, `select * from public.${table}`)).toEqual([])
      }
    expect((await db.query('select * from public.task_status_history')).rows).toEqual(before)
    await expect(
      asUser(db, users.dispatcher, "select public.create_task('x','',$1,$2)", [project, users.executor]),
    ).rejects.toThrow()
    await expect(
      asUser(db, users.dispatcher, "select public.update_task($1,'x','',$2,$3,1)", [
        task,
        project,
        users.executor,
      ]),
    ).rejects.toThrow()
  })
})
