import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { asUser, database, seedProfiles, users } from './harness'

let db: PGlite
beforeAll(async () => {
  db = await database()
  await seedProfiles(db)
})
afterAll(async () => {
  await db?.close()
})

it('rejects stale project edits rather than losing the latest address', async () => {
  const [project] = await asUser<{ id: string; revision: number }>(
    db,
    users.dispatcher,
    "select * from public.create_project('Объект','Первый адрес')",
  )
  await asUser(db, users.dispatcher2, "select public.update_project($1,'Объект','Новый адрес',$2)", [
    project.id,
    project.revision,
  ])
  await expect(
    asUser(db, users.dispatcher, "select public.update_project($1,'Новое имя','Первый адрес',$2)", [
      project.id,
      project.revision,
    ]),
  ).rejects.toThrow(/STALE_RECORD/)
  expect(
    (
      await asUser(db, users.dispatcher, 'select name,address,revision from public.projects where id=$1', [
        project.id,
      ])
    )[0],
  ).toMatchObject({ name: 'Объект', address: 'Новый адрес', revision: 2 })
})

it('a stale title edit cannot revert reassignment, object move or description', async () => {
  const [oldProject] = await asUser<{ id: string }>(
    db,
    users.dispatcher,
    "select * from public.create_project('Первый','Адрес')",
  )
  const [newProject] = await asUser<{ id: string }>(
    db,
    users.dispatcher,
    "select * from public.create_project('Второй','Адрес')",
  )
  const [task] = await asUser<{ id: string; revision: number }>(
    db,
    users.dispatcher,
    "select * from public.create_task('Задача','Старое описание',$1,$2)",
    [oldProject.id, users.executor],
  )
  await asUser(db, users.dispatcher2, "select public.update_task($1,'Задача','Новое описание',$2,$3,$4)", [
    task.id,
    newProject.id,
    users.executor2,
    task.revision,
  ])
  await expect(
    asUser(db, users.dispatcher, "select public.update_task($1,'Новое имя','Старое описание',$2,$3,$4)", [
      task.id,
      oldProject.id,
      users.executor,
      task.revision,
    ]),
  ).rejects.toThrow(/STALE_RECORD/)
  expect(
    (await asUser(db, users.executor2, 'select * from public.tasks where id=$1', [task.id]))[0],
  ).toMatchObject({
    title: 'Задача',
    description: 'Новое описание',
    project_id: newProject.id,
    assignee_id: users.executor2,
    revision: 2,
  })
  expect(await asUser(db, users.executor, 'select * from public.tasks where id=$1', [task.id])).toEqual([])
  expect(
    await asUser(db, users.executor, 'select * from public.task_status_history where task_id=$1', [task.id]),
  ).toEqual([])
})

it('a status change also invalidates a previously opened edit form', async () => {
  const [project] = await asUser<{ id: string }>(
    db,
    users.dispatcher,
    "select * from public.create_project('Третий','Адрес')",
  )
  const [task] = await asUser<{ id: string; revision: number }>(
    db,
    users.dispatcher,
    "select * from public.create_task('Задача','',$1,$2)",
    [project.id, users.executor],
  )
  await asUser(db, users.executor, "select public.change_task_status($1,'new','in_progress',null)", [task.id])
  await expect(
    asUser(db, users.dispatcher, "select public.update_task($1,'Правка','',$2,$3,$4)", [
      task.id,
      project.id,
      users.executor,
      task.revision,
    ]),
  ).rejects.toThrow(/STALE_RECORD/)
})
