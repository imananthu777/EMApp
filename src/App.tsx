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
    const savedUser = localStorage.getItem('authenticatedUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Listen for auth state changes (login/logout events)
    const handleAuthChange = () => {
      const currentUser = localStorage.getItem('authenticatedUser');
      if (currentUser) {
        setUser(JSON.parse(currentUser));
      } else {
        setUser(null);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthChange);
    
    const isFirstTime = localStorage.getItem('isFirstTimeUser');
    if (!isFirstTime) {
      setShowFirstTimePopup(true);
      localStorage.setItem('isFirstTimeUser', 'false');
    }
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange);
    };
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    // Store user in localStorage
    localStorage.setItem('authenticatedUser', JSON.stringify(userData));
    // Show onboarding only for new users after registration
    if (userData?.id && localStorage.getItem(`showOnboardingForUser_${userData.id}`)) {
      setShowFirstTimePopup(true);
      localStorage.removeItem(`showOnboardingForUser_${userData.id}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authenticatedUser');
    setUser(null);
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('auth-state-changed'));
  };

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
