import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { provision, publicClient, rpc, testAdmin } from '../helpers/supabase'

const admin = testAdmin()
type User = Awaited<ReturnType<typeof provision>>
let dispatcher: User, dispatcher2: User, executor: User, executor2: User, unassigned: User
let project: string, task: string

beforeAll(async () => {
  ;[dispatcher, dispatcher2, executor, executor2, unassigned] = await Promise.all([
    provision(admin, 'dispatcher'),
    provision(admin, 'dispatcher'),
    provision(admin, 'executor'),
    provision(admin, 'executor'),
    provision(admin, null),
  ])
  project = (
    await rpc(dispatcher.client, 'create_project', { p_name: 'Тестовый объект', p_address: 'Адрес' })
  ).id
  task = (
    await rpc(dispatcher.client, 'create_task', {
      p_title: 'Проверка доступа',
      p_description: '',
      p_project_id: project,
      p_assignee_id: executor.id,
    })
  ).id
})

afterAll(async () => {
  // Cleanup is local-only and uses admin privileges; never exposed in the application.
  if (project) {
    const { data: tasks } = await admin.from('tasks').select('id').eq('project_id', project)
    if (tasks?.length)
      await admin
        .from('task_status_history')
        .delete()
        .in(
          'task_id',
          tasks.map((t) => t.id),
        )
    await admin.from('tasks').delete().eq('project_id', project)
    await admin.from('projects').delete().eq('id', project)
  }
  for (const user of [dispatcher, dispatcher2, executor, executor2, unassigned].filter(Boolean)) {
    await user.client.auth.signOut()
    await admin.from('profiles').delete().eq('id', user.id)
    await admin.auth.admin.deleteUser(user.id)
  }
})

describe('real Supabase API with user JWTs', () => {
  it('filters nested reads and denies anonymous and profileless access', async () => {
    for (const client of [executor2.client, unassigned.client]) {
      const { data, error } = await client
        .from('projects')
        .select('*,tasks(*,task_status_history(*))')
        .eq('id', project)
      expect(error).toBeNull()
      expect(data).toEqual([])
    }
    const own = await executor.client.from('projects').select('*,tasks(*)').eq('id', project)
    expect(own.error).toBeNull()
    expect(own.data?.[0].tasks).toHaveLength(1)
    expect((await dispatcher2.client.from('tasks').select('id').eq('id', task)).data).toHaveLength(1)
    expect((await publicClient().from('tasks').select('*')).error).not.toBeNull()
  })
  it('rejects direct table writes and audit forgery for both roles', async () => {
    for (const client of [dispatcher.client, executor.client]) {
      expect(
        (await client.from('tasks').update({ status: 'accepted', author_id: executor.id }).eq('id', task))
          .error,
      ).not.toBeNull()
      expect(
        (await client.from('profiles').update({ role: 'dispatcher' }).eq('id', executor.id)).error,
      ).not.toBeNull()
      expect(
        (
          await client
            .from('task_status_history')
            .insert({ task_id: task, actor_id: executor.id, actor_name: 'fake', to_status: 'accepted' })
        ).error,
      ).not.toBeNull()
      expect(
        (await client.from('task_status_history').update({ comment: 'fake' }).eq('task_id', task)).error,
      ).not.toBeNull()
      expect((await client.from('task_status_history').delete().eq('task_id', task)).error).not.toBeNull()
    }
    expect(
      (
        await executor2.client.rpc('change_task_status', {
          p_task_id: task,
          p_expected_status: 'new',
          p_target_status: 'in_progress',
        })
      ).error,
    ).not.toBeNull()
    expect(
      (
        await dispatcher.client.rpc('change_task_status', {
          p_task_id: task,
          p_expected_status: 'new',
          p_target_status: 'in_progress',
        })
      ).error,
    ).not.toBeNull()
  })
  it('serializes concurrent status changes into exactly one history event', async () => {
    const args = { p_task_id: task, p_expected_status: 'new', p_target_status: 'in_progress' }
    const responses = await Promise.all([
      executor.client.rpc('change_task_status', args),
      executor.client.rpc('change_task_status', args),
    ])
    expect(responses.filter((r) => !r.error)).toHaveLength(1)
    expect(responses.filter((r) => r.error?.code === '40001')).toHaveLength(1)
    const { data } = await executor.client.from('task_status_history').select('*').eq('task_id', task)
    expect(data).toHaveLength(2)
  })
  it('ignores self-assigned roles in editable auth metadata', async () => {
    const { error } = await executor.client.auth.updateUser({ data: { role: 'dispatcher' } })
    expect(error).toBeNull()
    await expect(
      rpc(executor.client, 'create_project', { p_name: 'Запрещено', p_address: 'Адрес' }),
    ).rejects.toMatchObject({ code: '42501' })
  })
  it('runs review, rework and acceptance with database-owned history', async () => {
    const transition = (user: User, from: string, to: string, comment?: string) =>
      rpc(user.client, 'change_task_status', {
        p_task_id: task,
        p_expected_status: from,
        p_target_status: to,
        p_comment: comment ?? null,
      })
    await transition(executor, 'in_progress', 'review')
    await expect(transition(dispatcher, 'review', 'rework', ' \n')).rejects.toMatchObject({ code: '22023' })
    await transition(dispatcher, 'review', 'rework', 'Уточнить размеры')
    await transition(executor, 'rework', 'in_progress')
    await transition(executor, 'in_progress', 'review')
    await transition(dispatcher2, 'review', 'accepted')
    const { data } = await executor.client
      .from('task_status_history')
      .select('*')
      .eq('task_id', task)
      .order('id')
    expect(data?.map((h) => h.to_status)).toEqual([
      'new',
      'in_progress',
      'review',
      'rework',
      'in_progress',
      'review',
      'accepted',
    ])
    expect(data?.at(-1)?.actor_id).toBe(dispatcher2.id)
  })
  it('transfers access after reassignment and hides soft-deleted history', async () => {
    const { data: current } = await dispatcher.client.from('tasks').select('revision').eq('id', task).single()
    await rpc(dispatcher.client, 'update_task', {
      p_task_id: task,
      p_title: 'Переназначено',
      p_description: '',
      p_project_id: project,
      p_assignee_id: executor2.id,
      p_expected_revision: current!.revision,
    })
    expect((await executor.client.from('tasks').select('*').eq('id', task)).data).toEqual([])
    expect((await executor.client.from('task_status_history').select('*').eq('task_id', task)).data).toEqual(
      [],
    )
    expect((await executor2.client.from('tasks').select('status').eq('id', task)).data?.[0].status).toBe(
      'accepted',
    )
    await rpc(dispatcher.client, 'delete_project', { p_project_id: project })
    expect((await dispatcher.client.from('tasks').select('*').eq('id', task)).data).toEqual([])
    expect((await executor2.client.from('task_status_history').select('*').eq('task_id', task)).data).toEqual(
      [],
    )
    expect((await admin.from('task_status_history').select('id').eq('task_id', task)).data).toHaveLength(7)
  })
  it('does not allow public signup', async () => {
    const { error } = await publicClient().auth.signUp({
      email: 'should-not-register@example.test',
      password: 'DoNotRegister123!',
    })
    expect(error).not.toBeNull()
  })
})
