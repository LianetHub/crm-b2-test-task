import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { getProjects, getTasks } from '../../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { PageHeader } from '../../components/PageHeader'
import { TaskTable } from './TaskTable'

export function MyTasksPage() {
  const { profile } = useAuth()
  const tasks = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: ({ signal }) => getTasks(undefined, signal),
  })
  const projects = useQuery({ queryKey: ['projects'], queryFn: ({ signal }) => getProjects(signal) })
  if (profile?.role !== 'executor') return <Navigate to="/projects" replace />

  return (
    <>
      <PageHeader title="Мои задачи" subtitle="Задачи, назначенные вам на всех объектах." />
      {tasks.isPending || projects.isPending ? (
        <Loading />
      ) : tasks.error || projects.error ? (
        <ErrorPanel
          error={tasks.error ?? projects.error}
          retry={() => {
            void tasks.refetch()
            void projects.refetch()
          }}
        />
      ) : (
        <TaskTable
          tasks={tasks.data}
          projects={Object.fromEntries(projects.data.map((p) => [p.id, p.name]))}
        />
      )}
    </>
  )
}
