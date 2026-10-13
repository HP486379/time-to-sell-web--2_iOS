import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme, PaletteMode } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const themeFactory = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#7dd3fc' : '#1976d2',
      },
      secondary: {
        main: mode === 'dark' ? '#a78bfa' : '#7c3aed',
      },
      background:
        mode === 'dark'
          ? {
              default: '#0b1224',
              paper: '#121b2f',
            }
          : {
              default: '#f5f7fb',
              paper: '#ffffff',
            },
    },
    typography: {
      fontFamily: '"Inter", "Noto Sans JP", sans-serif',
    },
  })

const Root = () => {
  const [mode, setMode] = useState<PaletteMode>(() => {
    try {
      const stored = window.localStorage.getItem('themeMode')
      return stored === 'dark' || stored === 'light' ? stored : 'light'
    } catch {
      return 'light'
    }
  })
  const theme = useMemo(() => themeFactory(mode), [mode])
  useEffect(() => {
    try {
      window.localStorage.setItem('themeMode', mode)
    } catch {
      // Storage may be unavailable in private browsing; the theme still works.
    }
  }, [mode])

  const handleToggleMode = () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return (
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App mode={mode} onToggleMode={handleToggleMode} />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Root />)
