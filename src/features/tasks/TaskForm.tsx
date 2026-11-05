import { useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getExecutors, getProjects, saveTask } from '../../lib/api'
import type { Task, TaskInput } from '../../lib/types'
import { errorMessage, isEditConflict } from '../../lib/errors'
import { ErrorPanel, Loading } from '../../components/Feedback'

export function TaskForm({
  task,
  projectId,
  onClose,
}: {
  task?: Task
  projectId: string
  onClose: () => void
}) {
  const [original] = useState(task)
  const [input, setInput] = useState<TaskInput>({
    title: task?.title ?? '',
    description: task?.description ?? '',
    project_id: task?.project_id ?? projectId,
    assignee_id: task?.assignee_id ?? '',
  })
  const queryClient = useQueryClient()
  const executors = useQuery({ queryKey: ['executors'], queryFn: ({ signal }) => getExecutors(signal) })
  const projects = useQuery({ queryKey: ['projects'], queryFn: ({ signal }) => getProjects(signal) })
  const mutation = useMutation({
    mutationFn: () => saveTask(input, original),
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ])
      onClose()
    },
  })
  const set = (key: keyof TaskInput, value: string) => setInput((prev) => ({ ...prev, [key]: value }))
  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }
  const ready = !executors.isPending && !projects.isPending && !executors.error && !projects.error
  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{task ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
        <DialogContent>
          {!ready &&
            (executors.error || projects.error ? (
              <ErrorPanel
                error={executors.error ?? projects.error}
                retry={() => {
                  void executors.refetch()
                  void projects.refetch()
                }}
              />
            ) : (
              <Loading />
            ))}
          {ready && (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
              {!executors.data?.length && (
                <Alert severity="info">
                  Пока нет исполнителей. Попросите администратора добавить пользователя.
                </Alert>
              )}
              <TextField
                autoFocus
                required
                label="Название задачи"
                value={input.title}
                onChange={(e) => set('title', e.target.value)}
                disabled={mutation.isPending}
              />
              <TextField
                label="Описание"
                multiline
                minRows={3}
                value={input.description}
                onChange={(e) => set('description', e.target.value)}
                disabled={mutation.isPending}
              />
              <TextField
                select
                required
                label="Объект"
                value={input.project_id}
                onChange={(e) => set('project_id', e.target.value)}
                disabled={mutation.isPending}
              >
                {projects.data?.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                required
                label="Исполнитель"
                value={input.assignee_id}
                onChange={(e) => set('assignee_id', e.target.value)}
                disabled={mutation.isPending}
              >
                {executors.data?.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.display_name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              !ready ||
              mutation.isPending ||
              isEditConflict(mutation.error) ||
              !input.title.trim() ||
              !input.assignee_id ||
              !input.project_id
            }
          >
            {mutation.isPending ? 'Сохраняем…' : task ? 'Сохранить' : 'Создать задачу'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
