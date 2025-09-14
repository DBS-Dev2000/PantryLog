'use client'

import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material'

const theme = createTheme({
  palette: {
    primary: {
      main: '#87A96B', // Sage Green - freshness, sustainability, food preservation (PRIMARY)
      light: '#A8C68F',
      dark: '#6B8E4A',
    },
    secondary: {
      main: '#FFC947', // Warm Amber - optimization, savings, smart balance (SECONDARY)
      light: '#FFD369',
      dark: '#E6B142',
    },
    warning: {
      main: '#FFC947', // Warm Amber - optimization, savings, smart balance
      light: '#FFD369',
      dark: '#E6B142',
    },
    info: {
      main: '#2C3E50', // Deep Navy - reserved for info/technology elements
      light: '#546E7A',
      dark: '#1A252F',
    },
    error: {
      main: '#E74C3C', // Alert Red - expiration warnings and urgent notifications
      light: '#EC7063',
      dark: '#C0392B',
    },
    success: {
      main: '#27AE60', // Success Green - savings achieved and fresh items
      light: '#52C882',
      dark: '#229954',
    },
    background: {
      default: '#E8E8E8', // Soft Gray - backgrounds and neutral spaces
      paper: '#ffffff',
    },
    grey: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  )
}