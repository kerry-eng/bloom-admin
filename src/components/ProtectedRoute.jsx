import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
    const { user, isMentor, loading } = useAuth()

    if (loading) return (
        <div style={{
            display: 'flex', height: '100vh', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: '1rem',
            background: '#fdf6f0', color: '#7c6d8a', fontFamily: 'sans-serif'
        }}>
            <div style={{ fontSize: '2rem' }}>🌸</div>
            <p>Verifying access...</p>
        </div>
    )

    if (!user) return <Navigate to="/login" replace />

    if (!isMentor) {
        return (
            <div style={{ textAlign: 'center', padding: '5rem' }}>
                <h2>Access Denied</h2>
                <p>This panel is for mentors only.</p>
                <button className="btn btn-primary" onClick={() => window.location.href = '/'}>Go Back</button>
            </div>
        )
    }

    return children
}
