import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { RouterProvider } from './router/RouterProvider'
import { ToastProvider } from './toast/ToastProvider'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  </StrictMode>,
)
