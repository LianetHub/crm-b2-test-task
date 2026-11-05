import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { ProjectPage } from './features/projects/ProjectPage'
import { TaskPage } from './features/tasks/TaskPage'
import { MyTasksPage } from './features/tasks/MyTasksPage'
import { Layout } from './components/Layout'
import { ErrorPanel, Loading } from './components/Feedback'
import { isConfigured } from './lib/supabase'

function Protected() {
  const auth = useAuth()
  if (auth.loading) return <Loading />
  if (!auth.session) return <Navigate to="/login" replace />
  if (auth.error || !auth.profile)
    return (
      <Stack spacing={3} sx={{ maxWidth: 520, mx: 'auto', p: 4, mt: 8 }}>
        <Typography component="h1" variant="h5">
          {auth.error ? 'Не удалось загрузить профиль' : 'Роль ещё не назначена'}
        </Typography>
        {auth.error ? (
          <ErrorPanel error={auth.error} retry={auth.retry} />
        ) : (
          <Alert severity="info">
            Обратитесь к администратору, чтобы получить доступ к рабочему пространству.
          </Alert>
        )}
        <Button onClick={() => void auth.signOut().catch(() => auth.retry())}>Выйти</Button>
      </Stack>
    )
  return <Outlet />
}
function Home() {
  const { profile } = useAuth()
  return <Navigate to={profile?.role === 'executor' ? '/my-tasks' : '/projects'} replace />
}
export function App() {
  if (!isConfigured)
    return (
      <Box sx={{ maxWidth: 580, p: 4, mx: 'auto', mt: 10 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Подключите рабочее пространство
        </Typography>
        <Alert severity="info">
          Настройте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в .env.local, затем перезапустите
          приложение. Инструкция находится в README.
        </Alert>
      </Box>
    )
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
