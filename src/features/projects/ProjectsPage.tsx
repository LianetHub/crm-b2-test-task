import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Link, Paper, Stack, Typography } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import { Link as RouterLink } from 'react-router-dom'
import { getProjects, getTasks } from '../../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState, ErrorPanel, Loading } from '../../components/Feedback'
import { PageHeader } from '../../components/PageHeader'
import { ProjectForm } from './ProjectForm'

export function ProjectsPage() {
  const { profile } = useAuth()
  const [creating, setCreating] = useState(false)
  const projects = useQuery({ queryKey: ['projects'], queryFn: ({ signal }) => getProjects(signal) })
  const tasks = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: ({ signal }) => getTasks(undefined, signal),
  })
  const canEdit = profile?.role === 'dispatcher'

  return (
    <>
      <PageHeader
        title="Объекты"
        subtitle={
          canEdit ? 'Все стройки и задачи вашей команды.' : 'Объекты, на которых вам назначены задачи.'
        }
        actions={
          canEdit && (
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreating(true)}>
              Добавить объект
            </Button>
          )
        }
      />
      {projects.isPending || tasks.isPending ? (
        <Loading />
      ) : projects.error || tasks.error ? (
        <ErrorPanel
          error={projects.error ?? tasks.error}
          retry={() => {
            void projects.refetch()
            void tasks.refetch()
          }}
        />
      ) : !projects.data.length ? (
        <EmptyState
          title="Пока нет объектов"
          text={
            canEdit
              ? 'Добавьте первый объект и распределите задачи между исполнителями.'
              : 'Объекты появятся, когда вам назначат задачи.'
          }
        />
      ) : (
        <Stack spacing={1.5}>
          {projects.data.map((project) => {
            const count = tasks.data.filter((t) => t.project_id === project.id).length
            return (
              <Paper key={project.id} variant="outlined" sx={{ px: 2.5, py: 2 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Link
                      component={RouterLink}
                      to={`/projects/${project.id}`}
                      underline="hover"
                      color="text.primary"
                      sx={{ fontWeight: 650, fontSize: 17, overflowWrap: 'anywhere' }}
                    >
                      {project.name}
                    </Link>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                    >
                      {project.address}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {count} {pluralTasks(count)}
                  </Typography>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </>
  )
}

function pluralTasks(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'задача'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'задачи'
  return 'задач'
}
