import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider'

// Session expiry fans out across parallel requests (directory + badges +
// realtime all 401 at once), which used to stack identical toasts. Collapse
// them into a single notification: repeat expiry toasts within 10s are
// dropped. Scoped to the expiry message only — every other toast is untouched.
const rawToastError = toast.error.bind(toast)
let lastExpiryToastAt = 0
toast.error = (message, options) => {
  if (typeof message === 'string' && /session expired/i.test(message)) {
    const now = Date.now()
    if (now - lastExpiryToastAt < 10000) return ''
    lastExpiryToastAt = now
  }
  return rawToastError(message, options)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
