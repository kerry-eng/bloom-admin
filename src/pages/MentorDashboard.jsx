import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import './MentorDashboard.css'

export default function MentorDashboard() {
    const { user, isSuperAdmin } = useAuth()
    const navigate = useNavigate()
    const [sessions, setSessions] = useState([])
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState({})

    useEffect(() => {
        fetchAllSessions()
        if (isSuperAdmin) fetchAllMentors()
    }, [isSuperAdmin])

    async function fetchAllMentors() {
        const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'mentor')
        setMentors(data || [])
    }

    async function fetchAllSessions() {
        try {
            let query = supabase
                .from('sessions')
                .select('*, profiles:client_id(full_name, email), mentor:mentor_id(full_name)')

            if (!isSuperAdmin) {
                query = query.eq('mentor_id', user.id)
            }

            const { data, error } = await query.order('scheduled_at', { ascending: true })

            if (error) throw error
            setSessions(data || [])
        } catch (e) {
            console.error('Error fetching sessions:', e)
        } finally {
            setLoading(false)
        }
    }

    async function confirmBooking(sessionId) {
        setSaving(s => ({ ...s, [sessionId]: true }))
        try {
            await supabase
                .from('sessions')
                .update({ status: 'active' })
                .eq('id', sessionId)
            await fetchAllSessions()
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(s => ({ ...s, [sessionId]: false }))
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

    async function markCompleted(sessionId) {
        await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId)
        await fetchAllSessions()
    }

    const today = new Date()
    const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= today && s.status !== 'completed')
    const past = sessions.filter(s => new Date(s.scheduled_at) < today || s.status === 'completed')

    return (
        <div className="mentor-page">
            <div className="mentor__orbs" aria-hidden="true">
                <div className="orb orb-lavender" style={{ width: 250, height: 250, top: 0, right: 0 }} />
                <div className="orb orb-sage" style={{ width: 200, height: 200, bottom: '10%', left: 0, animationDelay: '3s' }} />
            </div>

            <div className="container mentor__container">
                <div className="mentor__header fade-in">
                    <div>
                        <p className="section-label">Admin Panel</p>
                        <h1 className="mentor__title">Admin Dashboard 🌸</h1>
                        <p style={{ color: 'var(--color-text-soft)' }}>
                            Manage your sessions and confirm bookings.
                        </p>
                    </div>
                    <div className="mentor__stats">
                        <div className="mentor__stat glass-card">
                            <span className="mentor__stat-num">{upcoming.length}</span>
                            <span className="mentor__stat-label">Upcoming</span>
                        </div>
                        <div className="mentor__stat glass-card">
                            <span className="mentor__stat-num">{past.length}</span>
                            <span className="mentor__stat-label">Completed</span>
                        </div>
                        <div className="mentor__stat glass-card">
                            <span className="mentor__stat-num">
                                KES {sessions.reduce((acc, s) => acc + (s.price || 0), 0).toLocaleString()}
                            </span>
                            <span className="mentor__stat-label">Total Revenue</span>
                        </div>
                    </div>
                </div>

                {/* Upcoming Sessions */}
                <section className="mentor__section">
                    <h2 className="mentor__section-title">Upcoming Sessions ({upcoming.length})</h2>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <div style={{ fontSize: '2rem' }}>🌸</div>
                        </div>
                    ) : upcoming.length === 0 ? (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
                            <p>No upcoming sessions booked yet.</p>
                        </div>
                    ) : (
                        <div className="mentor__sessions">
                            {upcoming.map(s => (
                                <div key={s.id} className="mentor-session glass-card fade-in">
                                    <div className="mentor-session__header">
                                        <div>
                                            <h4 className="mentor-session__client">
                                                👤 {s.profiles?.full_name || 'Client'}
                                                <span style={{ fontWeight: 400, color: 'var(--color-text-soft)', fontSize: '0.85rem' }}>
                                                    &nbsp;({s.profiles?.email})
                                                </span>
                                            </h4>
                                            <p className="mentor-session__meta">
                                                {s.session_label || s.session_type} &nbsp;·&nbsp;
                                                {new Date(s.scheduled_at).toLocaleString('en-NG', {
                                                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                            <span className={`badge ${s.status === 'active' ? 'badge-sage' : 'badge-lavender'}`}>
                                                {s.status}
                                            </span>
                                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-lavender-deep)' }}>
                                                KES {(s.price || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Confirm or Assign Mentor */}
                                    <div className="mentor-session__room" style={{ backgroundColor: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-lavender-light)', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text)' }}>
                                                    {s.status === 'paid' ? 'New Booking Request' : 'Manage Assignment'}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-soft)' }}>
                                                    {s.mentor ? `Assigned to: ${s.mentor.full_name}` : 'No mentor assigned yet.'}
                                                </p>
                                            </div>
                                            {s.status === 'paid' && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => confirmBooking(s.id)}
                                                    disabled={saving[s.id]}
                                                >
                                                    {saving[s.id] ? '...' : '✅ Confirm'}
                                                </button>
                                            )}
                                        </div>

                                        {isSuperAdmin && (
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
                                                <select
                                                    className="input"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', width: 'auto' }}
                                                    value={s.mentor_id || ''}
                                                    onChange={(e) => assignMentor(s.id, e.target.value)}
                                                    disabled={saving[s.id]}
                                                >
                                                    <option value="">Choose Mentor...</option>
                                                    {mentors.map(m => (
                                                        <option key={m.id} value={m.id}>{m.full_name}</option>
                                                    ))}
                                                </select>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-soft)' }}>Assign to Mentor</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Join session room button */}
                                    {s.status === 'active' && (
                                        <div className="mentor-session__room" style={{ gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text)' }}>Session is Active</p>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-soft)' }}>Click to join the video room with this client.</p>
                                            </div>
                                            <a
                                                href={`http://localhost:5173/session/${s.id}?role=mentor`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sage btn-sm"
                                            >
                                                🎥 Join as Mentor
                                            </a>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => markCompleted(s.id)}
                                            >
                                                ✓ Mark Done
                                            </button>
                                        </div>
                                    )}

                                    {/* Client reflections for active/upcoming sessions */}
                                    {(s.notes || s.take_homes || s.actionables || s.key_insights || s.challenges || s.next_steps) && (
                                        <div className="mentor-reflection-summary" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                            <div className="m-ref-grid">
                                                {s.notes && (
                                                    <div className="m-ref-item">
                                                        <h5>What has been done</h5>
                                                        <p>{s.notes}</p>
                                                    </div>
                                                )}
                                                {s.take_homes && (
                                                    <div className="m-ref-item">
                                                        <h5>What is pending</h5>
                                                        <p>{s.take_homes}</p>
                                                    </div>
                                                )}
                                                {s.actionables && (
                                                    <div className="m-ref-item">
                                                        <h5>Questions for next session</h5>
                                                        <p>{s.actionables}</p>
                                                    </div>
                                                )}
                                                {s.key_insights && (
                                                    <div className="m-ref-item">
                                                        <h5>Key Insights</h5>
                                                        <p>{s.key_insights}</p>
                                                    </div>
                                                )}
                                                {s.challenges && (
                                                    <div className="m-ref-item">
                                                        <h5>Challenges Faced</h5>
                                                        <p>{s.challenges}</p>
                                                    </div>
                                                )}
                                                {s.next_steps && (
                                                    <div className="m-ref-item">
                                                        <h5>My Next Steps</h5>
                                                        <p>{s.next_steps}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Past Sessions */}
                {past.length > 0 && (
                    <section className="mentor__section">
                        <h2 className="mentor__section-title">Session History ({past.length})</h2>
                        <div className="mentor__sessions">
                            {past.map(s => (
                                <div key={s.id} className="mentor-session mentor-session--past glass-card">
                                    <div className="mentor-session__header">
                                        <div>
                                            <h4 className="mentor-session__client">👤 {s.profiles?.full_name || 'Client'}</h4>
                                            <p className="mentor-session__meta">
                                                {s.session_label || s.session_type} · {new Date(s.scheduled_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className="badge badge-rose">Completed</span>
                                    </div>

                                    {(s.notes || s.take_homes || s.actionables || s.key_insights || s.challenges || s.next_steps) && (
                                        <div className="mentor-reflection-summary">
                                            <div className="m-ref-grid">
                                                {s.notes && (
                                                    <div className="m-ref-item">
                                                        <h5>What has been done</h5>
                                                        <p>{s.notes}</p>
                                                    </div>
                                                )}
                                                {s.take_homes && (
                                                    <div className="m-ref-item">
                                                        <h5>What is pending</h5>
                                                        <p>{s.take_homes}</p>
                                                    </div>
                                                )}
                                                {s.actionables && (
                                                    <div className="m-ref-item">
                                                        <h5>Questions for next session</h5>
                                                        <p>{s.actionables}</p>
                                                    </div>
                                                )}
                                                {s.key_insights && (
                                                    <div className="m-ref-item">
                                                        <h5>Key Insights</h5>
                                                        <p>{s.key_insights}</p>
                                                    </div>
                                                )}
                                                {s.challenges && (
                                                    <div className="m-ref-item">
                                                        <h5>Challenges Faced</h5>
                                                        <p>{s.challenges}</p>
                                                    </div>
                                                )}
                                                {s.next_steps && (
                                                    <div className="m-ref-item">
                                                        <h5>My Next Steps</h5>
                                                        <p>{s.next_steps}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
