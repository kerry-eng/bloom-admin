import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import './MentorDashboard.css' // Sharing styles for now

export default function AdminDashboard() {
    const { profile, isSuperAdmin } = useAuth()
    const navigate = useNavigate()
    const [sessions, setSessions] = useState([])
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState({})
    const [approving, setApproving] = useState({})

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/') // fallback
            return
        }
        fetchAllSessions()
        fetchAllMentors()
    }, [isSuperAdmin, navigate])

    async function fetchAllMentors() {
        const { data } = await supabase.from('profiles').select('id, full_name, role').eq('role', 'mentor')
        setMentors(data || [])
    }

    async function fetchAllSessions() {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('*, profiles:client_id(full_name, email), mentor:mentor_id(full_name)')
                .order('scheduled_at', { ascending: true })

            if (error) throw error
            setSessions(data || [])
        } catch (e) {
            console.error('Error fetching ALL sessions:', e)
        } finally {
            setLoading(false)
        }
    }

    async function assignMentor(sessionId, mentorId) {
        setSaving(s => ({ ...s, [sessionId]: true }))
        try {
            await supabase.from('sessions').update({ mentor_id: mentorId === '' ? null : mentorId }).eq('id', sessionId)
            await fetchAllSessions()
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(s => ({ ...s, [sessionId]: false }))
        }
    }

    async function approvePayment(sessionId) {
        setApproving(a => ({ ...a, [sessionId]: true }))
        try {
            await supabase.from('sessions').update({ status: 'active' }).eq('id', sessionId)
            await fetchAllSessions()
        } catch (e) {
            console.error(e)
        } finally {
            setApproving(a => ({ ...a, [sessionId]: false }))
        }
    }

    const today = new Date()
    const upcoming = sessions.filter(s => s.status !== 'completed' && s.status !== 'cancelled')
    const past = sessions.filter(s => new Date(s.scheduled_at) < today || s.status === 'completed')

    const pendingPayments = sessions.filter(s => (s.status?.trim().toLowerCase() === 'pending' || s.status?.trim().toLowerCase() === 'paid'))

    const stats = {
        pending: upcoming.length,
        completed: past.length,
        revenue: sessions.filter(s => s.status === 'active' || s.status === 'completed').reduce((acc, s) => acc + (s.price || 0), 0),
        activeMentors: mentors.length
    }

    const renderOverview = () => (
        <div className="mentor-overview fade-in">
            <div className="mentor-stats-row">
                <div className="mentor-stat-card">
                    <span className="stat-label">Total Outstanding</span>
                    <span className="stat-number">{stats.pending}</span>
                </div>
                <div className="mentor-stat-card">
                    <span className="stat-label">Total Mentors</span>
                    <span className="stat-number">{stats.activeMentors}</span>
                </div>
                <div className="mentor-stat-card">
                    <span className="stat-label">Platform Revenue</span>
                    <span className="stat-number">KES {stats.revenue.toLocaleString()}</span>
                </div>
                <div className="mentor-stat-card">
                    <span className="stat-label">System Status</span>
                    <span className="stat-number">HEALTHY</span>
                </div>
            </div>

            <div className="mentor-grid">
                <div className="mentor-main-panel">
                    <div className="mentor-card">
                        <h2>Global Schedule & Assignments</h2>
                        <div className="session-list">
                            {loading ? (
                                <p className="empty-msg">Loading platform sessions...</p>
                            ) : upcoming.length === 0 ? (
                                <p className="empty-msg">No upcoming sessions across the platform.</p>
                            ) : (
                                upcoming.map(s => (
                                    <div key={s.id} className="mentor-session-item">
                                        <div className="session-client-info">
                                            <h4>👤 {s.profiles?.full_name || 'Client'}</h4>
                                            <p>{s.session_label || s.session_type} • {new Date(s.scheduled_at).toLocaleString()}</p>
                                        </div>
                                        <div className="session-actions">
                                            <span className={`status-badge ${s.status}`}>{s.status.toUpperCase()}</span>
                                        </div>
                                        <div className="admin-assign-row">
                                            <select 
                                                value={s.mentor_id || ''} 
                                                onChange={(e) => assignMentor(s.id, e.target.value)}
                                                className="admin-select"
                                                disabled={saving[s.id]}
                                            >
                                                <option value="">Unassigned</option>
                                                {mentors.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                                            </select>
                                            
                                            {(s.status?.trim().toLowerCase() === 'pending' || s.status?.trim().toLowerCase() === 'paid') && (
                                                <button 
                                                    className="btn-mentor btn-mentor-primary btn-sm"
                                                    onClick={() => approvePayment(s.id)}
                                                    disabled={approving[s.id]}
                                                    style={{ marginLeft: '1rem', background: '#27ae60', padding: '0.4rem 1rem' }}
                                                >
                                                    {approving[s.id] ? '...' : '✓ APPROVE'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="mentor-side-panel">
                    <div className="mentor-card">
                        <h2>Admin Controls</h2>
                        <div className="mentor-actions-list">
                            <button className="btn-mentor btn-mentor-outline" onClick={() => navigate('/mentors')}>Manage Mentors Directory</button>
                            <button className="btn-mentor btn-mentor-outline">Platform Settings</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== PAYMENT APPROVALS PANEL ===== */}
            <div className="mentor-card" style={{ marginTop: '2rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    💳 Pending Payment Approvals
                    {pendingPayments.length > 0 && (
                        <span style={{ background: '#e74c3c', color: '#fff', borderRadius: '999px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: '700' }}>
                            {pendingPayments.length}
                        </span>
                    )}
                </h2>

                {loading ? (
                    <p className="empty-msg">Loading...</p>
                ) : pendingPayments.length === 0 ? (
                    <p className="empty-msg">✅ No payments awaiting approval.</p>
                ) : (
                    <div className="session-list">
                        {pendingPayments.map(s => (
                            <div key={s.id} className="mentor-session-item" style={{ borderLeft: '4px solid #e74c3c' }}>
                                <div className="session-client-info">
                                    <h4>👤 {s.profiles?.full_name || 'Client'}</h4>
                                    <p style={{ marginBottom: '0.25rem' }}>
                                        {s.session_label || s.session_type} — <strong>KES {(s.price || 0).toLocaleString()}</strong>
                                    </p>
                                    <p style={{ marginBottom: '0.25rem' }}>
                                        📅 {new Date(s.scheduled_at).toLocaleString()}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: '#888' }}>
                                        📧 {s.profiles?.email || 'N/A'}
                                    </p>
                                    <p style={{ marginTop: '0.5rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                                        M-Pesa Ref: <strong>{(s.stripe_payment_id || '').replace('LOOP_', '')}</strong>
                                    </p>
                                </div>
                                <div className="session-actions">
                                    <button
                                        onClick={() => approvePayment(s.id)}
                                        disabled={approving[s.id]}
                                        style={{
                                            background: approving[s.id] ? '#aaa' : '#27ae60',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '0.6rem 1.4rem',
                                            fontWeight: '700',
                                            cursor: approving[s.id] ? 'not-allowed' : 'pointer',
                                            fontSize: '0.9rem',
                                        }}
                                    >
                                        {approving[s.id] ? 'Approving...' : '✅ Approve Payment'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="mentor-dashboard-container">
            <header className="mentor-header">
                <div className="mentor-welcome">
                    <h1>Super Admin Overview</h1>
                    <p>Command center for the Bloom Mentorship platform.</p>
                </div>
            </header>
            {renderOverview()}
        </div>
    )
}
