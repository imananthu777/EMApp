import { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import FirstTimePopup from './components/FirstTimePopup'
import AdminDashboard from './components/AdminDashboard'
import './App.css'

function App() {
  const [user, setUser] = useState<any>(null)
  const [showFirstTimePopup, setShowFirstTimePopup] = useState(false)
  const location = window.location.pathname

  useEffect(() => {
    // Check for authenticated user in localStorage
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }

    const isFirstTime = localStorage.getItem('isFirstTimeUser')
    if (!isFirstTime) {
      setShowFirstTimePopup(true)
      localStorage.setItem('isFirstTimeUser', 'false')
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

  if (location === '/admin') {
    return <AdminDashboard />
  }

  return (
    <div className="container mx-auto p-4">
      {showFirstTimePopup && (
        <FirstTimePopup onClose={() => setShowFirstTimePopup(false)} />
      )}
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
