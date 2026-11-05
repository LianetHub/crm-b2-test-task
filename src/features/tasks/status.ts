import type { Role, TaskStatus } from '../../lib/types'

export const statusLabels: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export interface TaskAction {
  target: TaskStatus
  label: string
  requiresComment: boolean
}

/** UI convenience only. PostgreSQL independently authorizes every transition. */
export function availableActions(role: Role, status: TaskStatus, isAssignee: boolean): TaskAction[] {
  if (role === 'dispatcher' && status === 'review')
    return [
      { target: 'accepted', label: 'Принять задачу', requiresComment: false },
      { target: 'rework', label: 'На доработку', requiresComment: true },
    ]
  if (role !== 'executor' || !isAssignee) return []
  if (status === 'new' || status === 'rework')
    return [{ target: 'in_progress', label: 'Взять в работу', requiresComment: false }]
  if (status === 'in_progress')
    return [{ target: 'review', label: 'Отправить на проверку', requiresComment: false }]
  return []
}

export function nextStepHint(role: Role, status: TaskStatus): string {
  if (status === 'accepted') return 'Результат проверен постановщиком.'
  if (status === 'review') {
    return role === 'dispatcher'
      ? 'Проверьте результат и примите задачу или верните её с комментарием.'
      : 'Задача передана постановщику. Ожидайте проверки.'
  }
  if (role === 'dispatcher') return 'Следующее действие выполняет назначенный исполнитель.'
  if (status === 'in_progress') return 'Когда работа будет готова, отправьте результат на проверку.'
  if (status === 'rework') return 'Изучите комментарий в истории и возьмите задачу в работу.'
  return 'Возьмите задачу в работу, когда будете готовы приступить.'
}
