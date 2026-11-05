import type { Database } from './database.generated'
export type Role = Database['public']['Enums']['user_role']
export type TaskStatus = Database['public']['Enums']['task_status']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type HistoryEvent = Database['public']['Tables']['task_status_history']['Row']
export type TaskInput = Pick<Task, 'title' | 'description' | 'project_id' | 'assignee_id'>
