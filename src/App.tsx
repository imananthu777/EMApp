import { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check for authenticated user in localStorage
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (userData: any) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('registrationData')
    setUser(null)
  }

  return (
    <div className="container mx-auto p-4">
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
