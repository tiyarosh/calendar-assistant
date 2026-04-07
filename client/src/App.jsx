import { useState } from 'react'
import LoginScreen from './components/LoginScreen'
import MainLayout from './components/MainLayout'

export default function App() {
  const [accessToken, setAccessToken] = useState(null)

  if (!accessToken) {
    return <LoginScreen onLogin={setAccessToken} />
  }

  return <MainLayout accessToken={accessToken} onLogout={() => setAccessToken(null)} />
}
