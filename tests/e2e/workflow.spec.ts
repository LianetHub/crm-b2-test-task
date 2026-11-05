import { test, expect, type Page } from '@playwright/test'
import { provision, rpc, testAdmin } from '../helpers/supabase'

const admin = testAdmin()
type User = Awaited<ReturnType<typeof provision>>
let dispatcher: User, executor: User, otherExecutor: User, dispatcher2: User
let projectId: string
const projectName = `ЖК Северный ${Date.now()}`

test.beforeAll(async () => {
  ;[dispatcher, executor, otherExecutor, dispatcher2] = await Promise.all([
    provision(admin, 'dispatcher'),
    provision(admin, 'executor'),
    provision(admin, 'executor'),
    provision(admin, 'dispatcher'),
  ])
  await admin.from('profiles').update({ display_name: 'Иван Петров E2E' }).eq('id', executor.id)
  await admin.from('profiles').update({ display_name: 'Олег Соколов E2E' }).eq('id', otherExecutor.id)
})
test.afterAll(async () => {
  if (projectId) {
    const { data: tasks } = await admin.from('tasks').select('id').eq('project_id', projectId)
    if (tasks?.length)
      await admin
        .from('task_status_history')
        .delete()
        .in(
          'task_id',
          tasks.map((t) => t.id),
        )
    await admin.from('tasks').delete().eq('project_id', projectId)
    await admin.from('projects').delete().eq('id', projectId)
  }
  for (const user of [dispatcher, executor, otherExecutor, dispatcher2].filter(Boolean)) {
    await admin.from('profiles').delete().eq('id', user.id)
    await admin.auth.admin.deleteUser(user.id)
  }
})

async function login(page: Page, user: User) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
}

test('full task lifecycle, reassignment, isolation, soft delete and logout', async ({ page, browser }) => {
  await login(page, dispatcher)
  await page.getByRole('button', { name: 'Добавить объект' }).click()
  await page.getByLabel('Название объекта').fill(projectName)
  await page.getByLabel('Адрес').fill('ул. Строителей, 12')
  await page.getByRole('button', { name: 'Создать объект', exact: true }).click()
  await page.getByRole('link', { name: projectName, exact: true }).click()
  projectId = page.url().split('/').at(-1)!
  await page.getByRole('button', { name: 'Добавить задачу' }).click()
  await page.getByLabel('Название задачи').fill('Проверить армирование')
  await page.getByLabel('Описание').fill('Проверить узлы перед заливкой.')
  await page.getByLabel('Исполнитель').click()
  await page.getByRole('option', { name: 'Иван Петров E2E', exact: true }).click()
  await page.getByRole('button', { name: 'Создать задачу', exact: true }).click()
  await page.getByRole('link', { name: 'Проверить армирование', exact: true }).click()
  const taskUrl = page.url()
  await expect(page.getByRole('heading', { name: 'Проверить армирование' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Взять в работу' })).toHaveCount(0)

  // A's stale form must not undo B's reassignment even after polling refreshes the page props.
  await page.getByRole('button', { name: 'Редактировать задачу' }).click()
  await page.getByLabel('Название задачи').fill('Устаревшая правка')
  const taskId = taskUrl.split('/').at(-1)!
  const { data: beforeEdit } = await dispatcher2.client.from('tasks').select('*').eq('id', taskId).single()
  await rpc(dispatcher2.client, 'update_task', {
    p_task_id: taskId,
    p_title: beforeEdit!.title,
    p_description: beforeEdit!.description,
    p_project_id: projectId,
    p_assignee_id: otherExecutor.id,
    p_expected_revision: beforeEdit!.revision,
  })
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Запись изменена другим пользователем')
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Название задачи')).toHaveValue('Устаревшая правка')
  const { data: afterConflict } = await dispatcher2.client.from('tasks').select('*').eq('id', taskId).single()
  expect(afterConflict).toMatchObject({ title: 'Проверить армирование', assignee_id: otherExecutor.id })
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  await page.getByRole('button', { name: 'Редактировать задачу' }).click()
  await page.getByLabel('Исполнитель').click()
  await page.getByRole('option', { name: 'Иван Петров E2E', exact: true }).click()
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const workerContext = await browser.newContext()
  const worker = await workerContext.newPage()
  await login(worker, executor)
  await worker.getByRole('link', { name: 'Проверить армирование', exact: true }).click()
  await expect(worker.getByRole('button', { name: 'Редактировать задачу' })).toHaveCount(0)
  await worker.getByRole('button', { name: 'Взять в работу' }).click()
  await worker.getByRole('button', { name: 'Отправить на проверку' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'На доработку', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Вернуть на доработку' })).toBeDisabled()
  await page.getByLabel('Комментарий').fill('Уточнить шаг арматуры.')
  await page.getByRole('button', { name: 'Вернуть на доработку' }).click()
  await expect(page.getByText('Уточнить шаг арматуры.')).toBeVisible()
  await worker.reload()
  await worker.getByRole('button', { name: 'Взять в работу' }).click()
  await worker.getByRole('button', { name: 'Отправить на проверку' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Принять задачу' }).click()
  await expect(page.getByText('Задача принята')).toBeVisible()

  await page.getByRole('button', { name: 'Редактировать задачу' }).click()
  await page.getByLabel('Исполнитель').click()
  await page.getByRole('option', { name: 'Олег Соколов E2E', exact: true }).click()
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await worker.reload()
  await expect(worker.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible()

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await login(other, otherExecutor)
  await other.goto(taskUrl)
  await expect(other.getByText('Уточнить шаг арматуры.')).toBeVisible()
  await expect(other.getByText('Задача принята')).toBeVisible()

  await page.goto(`/projects/${projectId}`)
  await page.getByRole('button', { name: 'Удалить объект' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('link', { name: projectName, exact: true })).toHaveCount(0)
  await other.reload()
  await expect(other.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.goto(taskUrl)
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
  await workerContext.close()
  await otherContext.close()
})

test('mobile login and invalid credentials', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByLabel('Email').fill('unknown@example.test')
  await page.getByLabel('Пароль').fill('WrongPassword123!')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Неверный email или пароль')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
