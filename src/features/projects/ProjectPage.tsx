import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Link, Stack, Typography } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { deleteProject, getProject, getTasks } from '../../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { ErrorPanel, Loading, Unavailable } from '../../components/Feedback'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ProjectForm } from './ProjectForm'
import { TaskForm } from '../tasks/TaskForm'
import { TaskTable } from '../tasks/TaskTable'

export function ProjectPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const project = useQuery({ queryKey: ['projects', id], queryFn: ({ signal }) => getProject(id, signal) })
  const tasks = useQuery({
    queryKey: ['tasks', 'list', id],
    queryFn: ({ signal }) => getTasks(id, signal),
    enabled: Boolean(project.data),
  })
  if (project.isPending) return <Loading />
  if (project.error) return <ErrorPanel error={project.error} retry={() => void project.refetch()} />
  if (!project.data) return <Unavailable />
  const canEdit = profile?.role === 'dispatcher'
  return (
    <>
      <Link
        component={RouterLink}
        to="/projects"
        underline="hover"
        sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', fontSize: 12, mb: 3 }}
      >
        <ArrowBackRounded sx={{ fontSize: 16 }} />
        Все объекты
      </Link>
      <PageHeader
        title={project.data.name}
        subtitle={project.data.address}
        actions={
          canEdit && (
            <>
              <Button variant="outlined" onClick={() => setEditing(true)}>
                Редактировать объект
              </Button>
              <Button color="error" onClick={() => setDeleting(true)}>
                Удалить объект
              </Button>
            </>
          )
        }
      />
      <Box sx={{ px: 3, py: 2, bgcolor: '#eaf0e5', borderRadius: 2, mb: 4 }}>
        <Typography variant="body2">
          {canEdit
            ? 'Распределяйте работу и следите за результатом в задачах объекта.'
            : 'Здесь показаны только задачи, назначенные вам на этом объекте.'}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}
      >
        <Typography variant="h6" component="h2">
          Задачи объекта
        </Typography>
        {canEdit && (
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreatingTask(true)}>
            Добавить задачу
          </Button>
        )}
      </Stack>
      {tasks.isPending ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorPanel error={tasks.error} retry={() => void tasks.refetch()} />
      ) : (
        <TaskTable tasks={tasks.data} />
      )}
      {editing && <ProjectForm project={project.data} onClose={() => setEditing(false)} />}
      {creatingTask && <TaskForm projectId={id} onClose={() => setCreatingTask(false)} />}
      {deleting && (
        <ConfirmDialog
          open
          title="Удалить объект?"
          description="Объект и все его задачи исчезнут из рабочих списков. История изменений сохранится."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await deleteProject(id)
            navigate('/projects')
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['projects'] }),
              queryClient.invalidateQueries({ queryKey: ['tasks'] }),
              queryClient.invalidateQueries({ queryKey: ['history'] }),
            ])
          }}
        />
      )}
    </>
  )
}
