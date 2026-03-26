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

    const today = new Date()
    const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= today && s.status !== 'completed')
    const past = sessions.filter(s => new Date(s.scheduled_at) < today || s.status === 'completed')

    const stats = {
        pending: upcoming.length,
        completed: past.length,
        revenue: sessions.reduce((acc, s) => acc + (s.price || 0), 0),
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
                                            <span>{saving[s.id] ? 'Saving...' : 'Assign Mentor'}</span>
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
