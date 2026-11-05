import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { brand } from './lib/colors'
import { App } from './App'
import './styles.css'

const theme = createTheme({
  palette: {
    primary: { main: '#285b48', dark: brand.sidebar },
    secondary: { main: brand.accent },
    background: { default: '#f6f7f2', paper: '#ffffff' },
    text: { primary: '#243a30', secondary: '#778279' },
    divider: '#e5e9df',
  },
  typography: {
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 14,
    h4: { fontSize: '2rem', fontWeight: 650, letterSpacing: '-0.04em' },
    h5: { fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 550, fontSize: 12 },
    overline: { fontSize: 10, fontWeight: 600, letterSpacing: '0.16em' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, padding: '10px 17px', whiteSpace: 'nowrap' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '20px 22px', borderColor: '#edf0e9' },
        head: { backgroundColor: '#fafbf8', color: '#78857b', fontSize: 11, fontWeight: 550 },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: '#fff' } } },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 20, fontWeight: 600, paddingTop: 26 } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '18px 24px 24px' } } },
  },
})
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10000, refetchInterval: 15000, refetchOnWindowFocus: 'always', retry: 1 },
  },
})
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
