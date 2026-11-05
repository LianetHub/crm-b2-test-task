import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { changeStatus, deleteTask, getHistory, getProject, getTask } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import type { TaskStatus } from '../../lib/types'
import { useAuth } from '../auth/AuthProvider'
import { ErrorPanel, Loading, Unavailable } from '../../components/Feedback'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { TaskForm } from './TaskForm'
import { StatusChip } from './StatusChip'
import { TaskHistory } from './TaskHistory'
import { ReworkDialog } from './ReworkDialog'
import { availableActions, nextStepHint } from './status'

export function TaskPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [comment, setComment] = useState('')

  const task = useQuery({ queryKey: ['tasks', id], queryFn: ({ signal }) => getTask(id, signal) })
  const history = useQuery({
    queryKey: ['history', id],
    queryFn: ({ signal }) => getHistory(id, signal),
    enabled: Boolean(task.data),
  })
  const project = useQuery({
    queryKey: ['projects', task.data?.project_id],
    queryFn: ({ signal }) => getProject(task.data!.project_id, signal),
    enabled: Boolean(task.data),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['history', id] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ])
  }

  const transition = useMutation({
    mutationFn: ({ target, comment }: { target: TaskStatus; comment?: string }) =>
      changeStatus(task.data!, target, comment),
    onSuccess: () => {
      setCommentOpen(false)
      setComment('')
    },
    onSettled: refresh,
  })

  if (task.isPending) return <Loading />
  if (task.error) return <ErrorPanel error={task.error} retry={() => void task.refetch()} />
  if (!task.data || !profile) return <Unavailable />

  const record = task.data
  const canEdit = profile.role === 'dispatcher'
  const actions = availableActions(profile.role, record.status, record.assignee_id === profile.id)
  const accepted = record.status === 'accepted'

  return (
    <>
      <Link
        component={RouterLink}
        to={`/projects/${record.project_id}`}
        underline="hover"
        sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', fontSize: 12, mb: 3 }}
      >
        <ArrowBackRounded sx={{ fontSize: 16 }} />
        {project.data?.name ?? 'К объекту'}
      </Link>
      <PageHeader
        title={record.title}
        actions={
          canEdit && (
            <>
              <Button variant="outlined" onClick={() => setEditing(true)}>
                Редактировать задачу
              </Button>
              <Button color="error" onClick={() => setDeleting(true)}>
                Удалить задачу
              </Button>
            </>
          )
        }
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(310px, 1fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" component="h2">
                О задаче
              </Typography>
              <StatusChip status={record.status} />
            </Stack>
            <Typography
              sx={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                lineHeight: 1.8,
                color: record.description ? 'text.primary' : 'text.secondary',
              }}
            >
              {record.description || 'Описание не добавлено.'}
            </Typography>
            <Divider sx={{ my: 3 }} />
            <Box
              component="dl"
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, m: 0 }}
            >
              {[
                ['Исполнитель', record.assignee_name],
                ['Постановщик', record.author_name],
                ['Объект', project.data?.name ?? '—'],
                [
                  'Дата создания',
                  new Date(record.created_at).toLocaleString('ru-RU', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                ],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, mt: 0.7, fontWeight: 500, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, bgcolor: accepted ? 'action.hover' : 'background.paper' }}>
            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
              {accepted ? 'Задача принята' : 'Следующий шаг'}
            </Typography>
            {accepted ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CheckCircleOutlineRounded color="success" />
                <Typography variant="body2" color="text.secondary">
                  {nextStepHint(profile.role, record.status)}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: actions.length ? 2.5 : 0 }}>
                {nextStepHint(profile.role, record.status)}
              </Typography>
            )}
            {transition.error && !commentOpen && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage(transition.error)}
              </Alert>
            )}
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {actions.map((action) => (
                <Button
                  key={action.target}
                  variant={action.requiresComment ? 'outlined' : 'contained'}
                  disabled={transition.isPending}
                  onClick={() => {
                    transition.reset()
                    if (action.requiresComment) setCommentOpen(true)
                    else transition.mutate({ target: action.target })
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </Paper>
        </Stack>

        <TaskHistory
          events={history.data}
          loading={history.isPending}
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      </Box>

      {editing && <TaskForm task={record} projectId={record.project_id} onClose={() => setEditing(false)} />}
      {deleting && (
        <ConfirmDialog
          open
          title="Удалить задачу?"
          description="Задача исчезнет из рабочих списков. Её история останется сохранённой."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await deleteTask(id)
            navigate(`/projects/${record.project_id}`)
            await refresh()
          }}
        />
      )}
      <ReworkDialog
        open={commentOpen}
        comment={comment}
        pending={transition.isPending}
        error={transition.error}
        onCommentChange={setComment}
        onClose={() => setCommentOpen(false)}
        onSubmit={() => transition.mutate({ target: 'rework', comment })}
      />
    </>
  )
}
