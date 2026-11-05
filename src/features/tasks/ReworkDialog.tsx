import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { errorMessage } from '../../lib/errors'

export function ReworkDialog({
  open,
  comment,
  pending,
  error,
  onCommentChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  comment: string
  pending: boolean
  error: unknown
  onCommentChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <DialogTitle>Вернуть задачу на доработку</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            Объясните, что нужно исправить. Комментарий появится в истории задачи.
          </Typography>
          {error != null && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(error)}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={3}
            label="Комментарий"
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            disabled={pending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={!comment.trim() || pending}>
            Вернуть на доработку
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
