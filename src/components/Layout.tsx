import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import ApartmentRounded from '@mui/icons-material/ApartmentRounded'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import ChecklistRounded from '@mui/icons-material/ChecklistRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import MenuRounded from '@mui/icons-material/MenuRounded'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { brand } from '../lib/colors'
import { useAuth } from '../features/auth/AuthProvider'
import { errorMessage } from '../lib/errors'

const width = 250

export function Layout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  const logout = async () => {
    setPending(true)
    try {
      await signOut()
    } catch (e) {
      setError(e)
    } finally {
      setPending(false)
    }
  }

  const nav = [
    { href: '/projects', label: 'Объекты', icon: <GridViewRounded /> },
    ...(profile?.role === 'executor'
      ? [{ href: '/my-tasks', label: 'Мои задачи', icon: <ChecklistRounded /> }]
      : []),
  ]

  const sidebar = (
    <Stack sx={{ height: '100%', color: brand.textOnDark, p: 2.5, bgcolor: brand.sidebar }}>
      <Stack direction="row" spacing={1.3} sx={{ alignItems: 'center', p: 1, mt: 1, mb: 4 }}>
        <ApartmentRounded sx={{ color: brand.accent, fontSize: 31 }} />
        <Typography sx={{ fontWeight: 650, lineHeight: 1.3 }}>
          Объекты
          <br />и задачи
        </Typography>
      </Stack>
      <List component="nav" aria-label="Основная навигация">
        {nav.map((item) => (
          <ListItemButton
            component={RouterLink}
            to={item.href}
            key={item.href}
            onClick={() => setMenuOpen(false)}
            selected={pathname.startsWith(item.href)}
            sx={{
              mb: 1,
              py: 1.3,
              borderRadius: 2,
              '&.Mui-selected': {
                bgcolor: brand.accent,
                color: brand.selectedText,
                '&:hover': { bgcolor: brand.accentHover },
              },
              '&:hover': { bgcolor: brand.navHover },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <Box sx={{ display: { xs: 'none', md: 'block' }, width, flexShrink: 0 }}>
        <Box sx={{ width, position: 'fixed', height: '100dvh' }}>{sidebar}</Box>
      </Box>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} slotProps={{ paper: { sx: { width } } }}>
        {sidebar}
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          component="header"
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 72,
            px: { xs: 2, md: 4.5 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fff',
          }}
        >
          <IconButton
            aria-label="Открыть меню"
            onClick={() => setMenuOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuRounded />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#e7eee5', color: 'primary.main', width: 36, height: 36, fontSize: 14 }}>
              {profile?.display_name.slice(0, 1)}
            </Avatar>
            <Box sx={{ maxWidth: { xs: 120, sm: 220 } }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {profile?.display_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {profile?.role === 'dispatcher' ? 'Постановщик' : 'Исполнитель'}
              </Typography>
            </Box>
            <Button
              aria-label="Выйти"
              title="Выйти"
              onClick={() => void logout()}
              disabled={pending}
              color="inherit"
              sx={{ minWidth: 38, px: 1 }}
            >
              <LogoutRounded fontSize="small" />
            </Button>
          </Stack>
        </Stack>
        <Box
          component="main"
          sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, lg: 4.5 }, maxWidth: 1500, mx: 'auto' }}
        >
          {error != null && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(error)}
            </Alert>
          )}
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
