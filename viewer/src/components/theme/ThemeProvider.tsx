import React, { useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { StyledEngineProvider } from '@mui/material/styles'
import { useAppSelector } from '../../store/hooks'
import { selectDisplaySettings } from '../../store/slices/settingsSlice'

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const displaySettings = useAppSelector(selectDisplaySettings)

  const theme = useMemo(() => {
    const isDark = displaySettings.theme === 'dark' || 
      (displaySettings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    return createTheme({
      palette: {
        mode: isDark ? 'dark' : 'light',
        primary: {
          main: '#1976d2',
          light: '#42a5f5',
          dark: '#1565c0',
        },
        secondary: {
          main: '#dc004e',
          light: '#ff5983',
          dark: '#9a0036',
        },
        background: {
          default: isDark ? '#121212' : '#fafafa',
          paper: isDark ? '#1e1e1e' : '#ffffff',
        },
        text: {
          primary: isDark ? '#ffffff' : '#000000',
          secondary: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
        },
        error: {
          main: '#f44336',
        },
        warning: {
          main: '#ff9800',
        },
        info: {
          main: '#2196f3',
        },
        success: {
          main: '#4caf50',
        },
      },
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: displaySettings.fontSize === 'small' ? 12 : 
                  displaySettings.fontSize === 'large' ? 16 : 14,
        h1: {
          fontSize: '2.125rem',
          fontWeight: 300,
          lineHeight: 1.167,
        },
        h2: {
          fontSize: '1.5rem',
          fontWeight: 400,
          lineHeight: 1.2,
        },
        h3: {
          fontSize: '1.25rem',
          fontWeight: 500,
          lineHeight: 1.167,
        },
        h4: {
          fontSize: '1.125rem',
          fontWeight: 500,
          lineHeight: 1.235,
        },
        h5: {
          fontSize: '1rem',
          fontWeight: 500,
          lineHeight: 1.334,
        },
        h6: {
          fontSize: '0.875rem',
          fontWeight: 500,
          lineHeight: 1.6,
        },
        body1: {
          fontSize: '1rem',
          lineHeight: 1.5,
        },
        body2: {
          fontSize: '0.875rem',
          lineHeight: 1.43,
        },
        caption: {
          fontSize: '0.75rem',
          lineHeight: 1.66,
        },
      },
      shape: {
        borderRadius: displaySettings.compactMode ? 4 : 8,
      },
      spacing: displaySettings.compactMode ? 6 : 8,
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              scrollbarColor: isDark ? '#6b6b6b #2b2b2b' : '#959595 #f5f5f5',
              '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                backgroundColor: isDark ? '#2b2b2b' : '#f5f5f5',
                width: 8,
                height: 8,
              },
              '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                borderRadius: 8,
                backgroundColor: isDark ? '#6b6b6b' : '#959595',
                minHeight: 24,
              },
              '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
                backgroundColor: isDark ? '#959595' : '#6b6b6b',
              },
              '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
                backgroundColor: isDark ? '#959595' : '#6b6b6b',
              },
              '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
                backgroundColor: isDark ? '#959595' : '#6b6b6b',
              },
              '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
                backgroundColor: isDark ? '#2b2b2b' : '#f5f5f5',
              },
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
              color: isDark ? '#ffffff' : '#000000',
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
              borderRight: `1px solid ${isDark ? '#333333' : '#e0e0e0'}`,
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: displaySettings.compactMode ? 4 : 8,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
              borderRadius: displaySettings.compactMode ? 4 : 12,
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
            },
          },
        },
        MuiTooltip: {
          defaultProps: {
            disableHoverListener: !displaySettings.showTooltips,
            disableFocusListener: !displaySettings.showTooltips,
            disableTouchListener: !displaySettings.showTooltips,
          },
        },
      },
      transitions: {
        // Respect user's motion preferences
        duration: {
          shortest: displaySettings.reducedMotion ? 0 : 150,
          shorter: displaySettings.reducedMotion ? 0 : 200,
          short: displaySettings.reducedMotion ? 0 : 250,
          standard: displaySettings.reducedMotion ? 0 : 300,
          complex: displaySettings.reducedMotion ? 0 : 375,
          enteringScreen: displaySettings.reducedMotion ? 0 : 225,
          leavingScreen: displaySettings.reducedMotion ? 0 : 195,
        },
      },
    })
  }, [displaySettings])

  return (
    <StyledEngineProvider injectFirst>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </StyledEngineProvider>
  )
}