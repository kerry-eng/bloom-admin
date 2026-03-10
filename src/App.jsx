import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import MentorDashboard from './pages/MentorDashboard'
import Mentors from './pages/Mentors'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const { loading, signOut, user, isMentor, isSuperAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        background: '#fdf6f0',
        fontFamily: 'sans-serif',
        color: '#7c6d8a'
      }}>
        <div style={{ fontSize: '2rem' }}>🌸</div>
        <p>Loading Bloom Admin...</p>
      </div>
    )
  }

  return (
    <>
      {user && isMentor && (
        <nav style={{ padding: '1rem', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 1000, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-lavender-light)' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-dark)' }}>🌸 Bloom Admin</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/" style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500 }}>Sessions</Link>
              {isSuperAdmin && <Link to="/mentors" style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500 }}>Mentors</Link>}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={signOut}>Sign Out</button>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute><MentorDashboard /></ProtectedRoute>
        } />
        <Route path="/mentors" element={
          <ProtectedRoute><Mentors /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
