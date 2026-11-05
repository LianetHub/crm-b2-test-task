import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import ApartmentRounded from '@mui/icons-material/ApartmentRounded'
import { Navigate } from 'react-router-dom'
import { brand } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errors'
import { useAuth } from './AuthProvider'
import { Loading } from '../../components/Feedback'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (auth.loading) return <Loading />
  if (auth.session) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
    } catch (e) {
      setError(e)
    } finally {
      setPending(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <Box
        sx={{
          bgcolor: brand.sidebar,
          color: '#fff',
          p: { xs: 4, md: 7 },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
          <ApartmentRounded sx={{ color: brand.accent, fontSize: 32 }} />
          <Typography variant="h6">Объекты и задачи</Typography>
        </Stack>
        <Typography color={brand.muted}>Мини-CRM для строительных объектов и задач команды.</Typography>
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 3, md: 7 }, bgcolor: 'background.default' }}>
        <Paper elevation={0} sx={{ width: '100%', maxWidth: 410, bgcolor: 'transparent', py: 4 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3, display: { md: 'none' } }}>
            <ApartmentRounded sx={{ color: 'primary.dark', fontSize: 28 }} />
            <Typography variant="h6">Объекты и задачи</Typography>
          </Stack>
          <Typography variant="h4" component="h1" sx={{ mb: 1.5 }}>
            Вход
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Email и пароль выдаёт руководитель. Самостоятельная регистрация недоступна.
          </Typography>
          <Stack component="form" onSubmit={submit} spacing={2.5}>
            {error != null && <Alert severity="error">{errorMessage(error)}</Alert>}
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              disabled={pending}
            />
            <TextField
              label="Пароль"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              disabled={pending}
            />
            <Button
              variant="contained"
              type="submit"
              size="large"
              disabled={pending || !email.trim() || !password}
            >
              {pending ? 'Входим…' : 'Войти'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}
