import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

const local = process.argv.includes('--local')
config({ path: local ? '.env.test' : '.env.seed', quiet: true })
const url = local ? process.env.TEST_SUPABASE_URL : process.env.SUPABASE_URL
const publicKey = local ? process.env.TEST_SUPABASE_ANON_KEY : process.env.SUPABASE_PUBLISHABLE_KEY
const adminKey = local ? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !publicKey || !adminKey)
  throw new Error('Missing seed environment. See .env.seed.example or configure-local.mjs.')
if (local && !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
  throw new Error('--local requires localhost')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, adminKey, options)
const accessPath = local ? '.cache/demo-access.local.json' : '.cache/demo-access.cloud.json'
let state
try {
  state = JSON.parse(await readFile(accessPath, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (state && state.url !== url)
  throw new Error('Saved demo credentials belong to a different project; use a separate workspace.')
state ??= { url, users: [], projects: [], tasks: [], complete: false }
await mkdir('.cache', { recursive: true })
const persist = () => writeFile(accessPath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
if (state.complete) {
  console.log(`Demo already seeded. Credentials: ${accessPath} (ignored by Git).`)
  process.exit(0)
}
const definitions = [
  { role: 'dispatcher', display_name: 'Анна Смирнова', email: 'manager@crm-demo.example' },
  { role: 'executor', display_name: 'Иван Петров', email: 'ivan@crm-demo.example' },
  { role: 'executor', display_name: 'Мария Волкова', email: 'maria@crm-demo.example' },
]
for (const definition of definitions) {
  if (state.users.some((u) => u.email === definition.email)) continue
  const password = `Crm!${randomBytes(18).toString('base64url')}`
  const { data, error } = await admin.auth.admin.createUser({
    email: definition.email,
    password,
    email_confirm: true,
  })
  if (error)
    throw new Error(
      `Could not create ${definition.email}: ${error.message}. Existing users are never overwritten.`,
    )
  state.users.push({ ...definition, id: data.user.id, password })
  await persist()
}
const clients = []
for (const user of state.users) {
  const { error } = await admin
    .from('profiles')
    .upsert({ id: user.id, role: user.role, display_name: user.display_name })
  if (error) throw error
  const client = createClient(url, publicKey, options)
  const { error: loginError } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (loginError) throw loginError
  clients.push(client)
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}
const projects = [
  ['ЖК «Северный парк»', 'Москва, ул. Строителей, 12'],
  ['Бизнес-центр «Горизонт»', 'Москва, проспект Мира, 48'],
  ['Коттеджный посёлок «Лесной»', 'Московская область, посёлок Лесной'],
]
for (let i = state.projects.length; i < projects.length; i++) {
  state.projects.push(
    await rpc(clients[0], 'create_project', { p_name: projects[i][0], p_address: projects[i][1] }),
  )
  await persist()
}
const definitionsTasks = [
  [
    'Проверить армирование перекрытия',
    'Сверить шаг арматуры и защитный слой с проектом. Зафиксировать результат перед заливкой.',
    0,
    1,
    'new',
  ],
  [
    'Подготовить площадку к заливке',
    'Проверить опалубку, очистить рабочую зону и согласовать готовность с бригадой.',
    0,
    2,
    'in_progress',
  ],
  [
    'Принять поставку материалов',
    'Сверить количество и маркировку материалов с накладной.',
    0,
    1,
    'accepted',
  ],
  ['Проверить монтаж перегородок', 'Проверить геометрию и соответствие плану второго этажа.', 1, 2, 'review'],
  [
    'Уточнить схему электропроводки',
    'Сверить расположение выводов с актуальной планировкой.',
    1,
    1,
    'rework',
  ],
  [
    'Проверить утепление фасада',
    'Осмотреть примыкания и крепления утеплителя на северной стороне.',
    2,
    2,
    'new',
  ],
  ['Подготовить акт скрытых работ', 'Подготовить акт по фундаменту первого дома.', 2, 1, 'in_progress'],
]
for (let i = 0; i < definitionsTasks.length; i++) {
  const [title, description, projectIndex, userIndex, target] = definitionsTasks[i]
  if (!state.tasks[i]) {
    state.tasks[i] = await rpc(clients[0], 'create_task', {
      p_title: title,
      p_description: description,
      p_project_id: state.projects[projectIndex].id,
      p_assignee_id: state.users[userIndex].id,
    })
    await persist()
  }
  let current = (await clients[0].from('tasks').select('*').eq('id', state.tasks[i].id).single()).data
  if (!current) throw new Error('A demo task was deleted. Seed does not restore user changes.')
  const path =
    target === 'new'
      ? ['new']
      : target === 'in_progress'
        ? ['new', 'in_progress']
        : ['new', 'in_progress', 'review', ...(target === 'review' ? [] : [target])]
  const position = path.indexOf(current.status)
  if (position < 0) throw new Error('Demo state was changed outside the seed. Not overwriting it.')
  for (const next of path.slice(position + 1)) {
    current = await rpc(
      ['accepted', 'rework'].includes(next) ? clients[0] : clients[userIndex],
      'change_task_status',
      {
        p_task_id: current.id,
        p_expected_status: current.status,
        p_target_status: next,
        p_comment:
          next === 'rework' ? 'Добавьте выводы для освещения в зоне лестницы и обновите схему.' : null,
      },
    )
    state.tasks[i] = current
    await persist()
  }
}
state.complete = true
await persist()
await Promise.all(clients.map((client) => client.auth.signOut()))
console.log(
  `Demo ready: 3 users, 3 projects, 7 tasks, all 5 statuses. Credentials: ${accessPath} (ignored by Git).`,
)
