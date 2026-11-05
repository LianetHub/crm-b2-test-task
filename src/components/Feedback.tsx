import { Alert, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { errorMessage } from '../lib/errors'

export function Loading({ label = 'Загружаем данные…' }: { label?: string }) {
  return (
    <Stack role="status" spacing={2} sx={{ alignItems: 'center', py: 10 }}>
      <CircularProgress size={26} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  )
}

export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        retry && (
          <Button color="inherit" onClick={retry}>
            Повторить
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </Alert>
  )
}

export function Unavailable() {
  return (
    <EmptyState
      title="Запись недоступна"
      text="Она могла быть удалена или доступ к ней изменился."
      action={
        <Button component={RouterLink} to="/projects">
          К объектам
        </Button>
      }
    />
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: React.ReactNode
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 7 }, textAlign: 'center' }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: action ? 3 : 0 }}>
        {text}
      </Typography>
      {action}
    </Paper>
  )
}
