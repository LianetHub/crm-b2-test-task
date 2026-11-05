import { useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '../../lib/types'
import { saveProject } from '../../lib/api'
import { errorMessage, isEditConflict } from '../../lib/errors'

export function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const [original] = useState(project)
  const [name, setName] = useState(project?.name ?? '')
  const [address, setAddress] = useState(project?.address ?? '')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => saveProject({ name, address }, original),
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }
  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{project ? 'Редактировать объект' : 'Новый объект'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
            <TextField
              autoFocus
              required
              label="Название объекта"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mutation.isPending}
            />
            <TextField
              required
              label="Адрес"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={mutation.isPending}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending || isEditConflict(mutation.error) || !name.trim() || !address.trim()}
          >
            {mutation.isPending ? 'Сохраняем…' : project ? 'Сохранить' : 'Создать объект'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
