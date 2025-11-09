import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from 'react-error-boundary'

import App from './App'
import { store } from './store'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { ErrorFallback } from './components/ui/ErrorFallback'

import './index.css'

// Simple error boundary error handler
const handleError = (error: Error) => {
  console.error('Application error:', error)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
      <HelmetProvider>
        <Provider store={store}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Provider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)