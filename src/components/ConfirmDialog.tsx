import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../lib/errors'

export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
        {error != null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Отмена
        </Button>
        <Button color="error" variant="contained" onClick={() => void confirm()} disabled={pending}>
          {pending ? 'Удаляем…' : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
