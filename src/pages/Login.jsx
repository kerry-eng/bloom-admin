import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
    const [mode, setMode] = useState('signin') // 'signin' | 'signup'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [specialty, setSpecialty] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn, signUp, signInWithGoogle } = useAuth()
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            if (mode === 'signup') {
                // Pass specialty as part of the expertise array in metadata
                await signUp(email, password, fullName, 'mentor', { expertise: [specialty] })
                alert('Application submitted! Please check your email and wait for admin approval.')
            } else {
                await signIn(email, password)
                navigate('/')
            }
        } catch (err) {
            setError(err.message || 'Something went wrong.')
        } finally {
            setLoading(false)
        }
    }

    async function handleGoogleLogin() {
        try {
            await signInWithGoogle('mentor')
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="auth-nature-container">
            <div className="auth-nature-overlay" />

            <div className="auth-nature-card fade-in">
                <div className="transformation-inner-glow" aria-hidden="true"></div>

                <div className="auth-card-main">
                    <div className="login-brand" style={{ marginBottom: '1.5rem' }}>
                        <span className="logo-text" style={{ color: '#fff', fontSize: '1.5rem' }}>Bloom Admin</span>
                    </div>

                    <h1 className="auth-card-title">
                        {mode === 'signin' ? 'Mentor Login' : 'Mentor Sign Up'}
                    </h1>

                    <p className="login-subtitle" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
                        {mode === 'signin' ? 'EXCELLENCE IN MENTORSHIP' : 'JOIN OUR GLOBAL TEAM'}
                    </p>

                    <div className="auth-card-switcher">
                        {mode === 'signin' ? (
                            <span>New Mentor? <button onClick={() => setMode('signup')}>Join us</button></span>
                        ) : (
                            <span>Already registered? <button onClick={() => setMode('signin')}>Log in</button></span>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="auth-nature-form">
                        {mode === 'signup' && (
                            <>
                                <div className="nature-input-group">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        placeholder="Your full name"
                                        required
                                    />
                                </div>
                                <div className="nature-input-group">
                                    <label>Primary Area of Expertise</label>
                                    <input
                                        type="text"
                                        value={specialty}
                                        onChange={e => setSpecialty(e.target.value)}
                                        placeholder="e.g. Career, Anxiety, Technical Skills"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        <div className="nature-input-group">
                            <label>Professional Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@bloom.com"
                                required
                            />
                        </div>

                        <div className="nature-input-group">
                            <label>Security Key</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <button type="submit" className="nature-submit-btn" disabled={loading}>
                            {loading ? 'Processing...' : (mode === 'signin' ? 'Enter Dashboard →' : 'Submit Application →')}
                        </button>
                    </form>

                    <div className="auth-social-sect">
                        <div className="social-divider">
                            <span>or continue with</span>
                        </div>
                        <button onClick={handleGoogleLogin} className="btn-google-arch-nature" disabled={loading}>
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
                            Login with Google
                        </button>
                    </div>
                    
                    <div style={{ marginTop: '2rem', fontSize: '0.8rem', opacity: 0.6 }}>
                        Authorized Personnel Only
                    </div>
                </div>
            </div>
        </div>
    )
}
