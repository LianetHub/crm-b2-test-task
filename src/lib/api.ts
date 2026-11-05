import { supabase } from './supabase'
import { readAll } from './readAll'
import type { HistoryEvent, Profile, Project, Task, TaskInput, TaskStatus } from './types'

function withSignal<T extends { abortSignal(signal: AbortSignal): T }>(request: T, signal?: AbortSignal) {
  return signal ? request.abortSignal(signal) : request
}

export async function getProfile(userId: string, signal?: AbortSignal) {
  const { data, error } = await withSignal(
    supabase.from('profiles').select('*').eq('id', userId),
    signal,
  ).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function getProjects(signal?: AbortSignal) {
  return readAll<Project>((from, to) =>
    withSignal(
      supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
      signal,
    ),
  )
}

export async function getProject(id: string, signal?: AbortSignal) {
  const { data, error } = await withSignal(
    supabase.from('projects').select('*').eq('id', id),
    signal,
  ).maybeSingle()
  if (error) throw error
  return data as Project | null
}

export async function getTasks(projectId?: string, signal?: AbortSignal) {
  return readAll<Task>((from, to) => {
    let request = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    if (projectId) request = request.eq('project_id', projectId)
    return withSignal(request, signal)
  })
}

export async function getTask(id: string, signal?: AbortSignal) {
  const { data, error } = await withSignal(
    supabase.from('tasks').select('*').eq('id', id),
    signal,
  ).maybeSingle()
  if (error) throw error
  return data as Task | null
}

export async function getHistory(id: string, signal?: AbortSignal) {
  return readAll<HistoryEvent>((from, to) =>
    withSignal(
      supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', id)
        .order('id', { ascending: false })
        .range(from, to),
      signal,
    ),
  )
}

export async function getExecutors(signal?: AbortSignal) {
  return readAll<Profile>((from, to) =>
    withSignal(
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'executor')
        .order('display_name')
        .order('id')
        .range(from, to),
      signal,
    ),
  )
}

async function mutate<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  return data
}

export const saveProject = (
  input: { name: string; address: string },
  existing?: Pick<Project, 'id' | 'revision'>,
) => {
  const args = { p_name: input.name.trim(), p_address: input.address.trim() }
  return existing
    ? mutate(
        supabase.rpc('update_project', {
          ...args,
          p_project_id: existing.id,
          p_expected_revision: existing.revision,
        }),
      )
    : mutate(supabase.rpc('create_project', args))
}

export const deleteProject = (id: string) => mutate(supabase.rpc('delete_project', { p_project_id: id }))

export const saveTask = (input: TaskInput, existing?: Pick<Task, 'id' | 'revision'>) => {
  const args = {
    p_title: input.title.trim(),
    p_description: input.description,
    p_project_id: input.project_id,
    p_assignee_id: input.assignee_id,
  }
  return existing
    ? mutate(
        supabase.rpc('update_task', {
          ...args,
          p_task_id: existing.id,
          p_expected_revision: existing.revision,
        }),
      )
    : mutate(supabase.rpc('create_task', args))
}

export const deleteTask = (id: string) => mutate(supabase.rpc('delete_task', { p_task_id: id }))

export const changeStatus = (task: Task, target: TaskStatus, comment?: string) =>
  mutate(
    supabase.rpc('change_task_status', {
      p_task_id: task.id,
      p_expected_status: task.status,
      p_target_status: target,
      ...(comment?.trim() ? { p_comment: comment.trim() } : {}),
    }),
  )
