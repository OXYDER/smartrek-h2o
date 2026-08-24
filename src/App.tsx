import { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { LoginScreen } from './components/LoginScreen'
import { getCachedToken, clearToken } from './api/auth'

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getCachedToken()))

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />
  }

  return (
    <Dashboard
      onLogout={() => {
        clearToken()
        setAuthed(false)
      }}
    />
  )
}
