export function errorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number }
  if (e.message === 'STALE_RECORD')
    return 'Запись изменена другим пользователем. Закройте форму и откройте её заново, чтобы увидеть актуальные данные. Ваши изменения не сохранены.'
  if (e.message === 'Invalid login credentials' || e.code === 'invalid_credentials')
    return 'Неверный email или пароль.'
  if (e.code === '40001') return 'Задача уже изменилась. Данные обновлены — повторите действие.'
  if (e.code === 'P0002') return 'Запись недоступна. Возможно, она удалена или назначена другому исполнителю.'
  if (e.message === 'COMMENT_REQUIRED') return 'Напишите комментарий для возврата на доработку.'
  if (e.message === 'INVALID_ASSIGNEE') return 'Выберите действующего исполнителя.'
  if (e.message === 'INVALID_TRANSITION') return 'Это действие недоступно в текущем статусе.'
  if (e.code === '42501') return 'У вас нет прав на это действие.'
  if (e.code === '23514' || e.code === '23502' || e.code === '22023')
    return 'Проверьте обязательные поля формы.'
  if (e.status === 429 || e.code === 'over_request_rate_limit')
    return 'Слишком много попыток. Подождите немного и повторите.'
  if (e.status === 401 || e.code === 'PGRST301') return 'Сессия истекла. Войдите ещё раз.'
  if (e.message?.includes('fetch') || e.message?.includes('network'))
    return 'Не удалось связаться с сервером. Проверьте соединение и повторите.'
  return 'Не удалось выполнить действие. Попробуйте ещё раз.'
}

export function isEditConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '40001')
}
