import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import DashboardTopbar from '../components/DashboardTopbar'
import VideoCallModal from '../components/VideoCallModal'
import './MentorDashboard.css'

function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
}

function isJoinable(dateStr) {
    const diff = new Date(dateStr) - new Date()
    return diff < 15 * 60000 && diff > -90 * 60000
}

export default function MentorDashboard({ activeView = 'overview', setActiveView }) {
    const { user, profile, refreshProfile } = useAuth()
    const navigate = useNavigate()
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState({})
    const [votd, setVotd] = useState({ text: 'As iron sharpens iron, so one person sharpens another.', reference: 'Proverbs 27:17' })
    const [selectedMood, setSelectedMood] = useState('🚀')
    const [reflectionForm, setReflectionForm] = useState({ notes: '', key_insights: '', next_steps: '' })
    const [activeReflectionSession, setActiveReflectionSession] = useState(null)
    const [saveStatus, setSaveStatus] = useState('')
    const [profileForm, setProfileForm] = useState({ full_name: '', bio: '', phone: '' })
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileSaved, setProfileSaved] = useState(false)
    const bannerInputRef = useRef(null)
    const avatarInputRef = useRef(null)
    const [uploading, setUploading] = useState({ banner: false, avatar: false })
    const [activeVideoSession, setActiveVideoSession] = useState(null)

    const isVerified = profile?.verification_status === 'verified'

    useEffect(() => {
        if (user) {
            fetchSessions()
            fetchVotd()
        }
    }, [user])

    useEffect(() => {
        if (profile) {
            setProfileForm({
                full_name: profile.full_name || '',
                bio: profile.bio || '',
                phone: profile.phone || ''
            })
        }
    }, [profile])

    async function fetchVotd() {
        try {
            const resp = await fetch('https://labs.bible.org/api/?passage=votd&type=json')
            const data = await resp.json()
            if (data && data[0]) {
                setVotd({ text: data[0].text, reference: `${data[0].bookname} ${data[0].chapter}:${data[0].verse}` })
            }
        } catch (e) { /* fallback */ }
    }

    async function fetchSessions() {
        setLoading(true)
        try {
            const { data: sessData, error } = await supabase
                .from('sessions')
                .select('*, profiles:client_id(full_name, email, avatar_url)')
                .eq('mentor_id', user.id)
                .order('scheduled_at', { ascending: true })
            if (error) throw error
            setSessions(sessData || [])

            const pastCompleted = (sessData || []).filter(s => s.status === 'completed')
            if (pastCompleted.length > 0) {
                const latest = pastCompleted[pastCompleted.length - 1]
                setActiveReflectionSession(latest)
                setReflectionForm({
                    notes: latest.notes || '',
                    key_insights: latest.key_insights || '',
                    next_steps: latest.next_steps || ''
                })
            }
        } catch (e) {
            console.error('Error fetching sessions:', e)
        } finally {
            setLoading(false)
        }
    }

    async function confirmBooking(sessionId) {
        setSaving(s => ({ ...s, [sessionId]: 'confirming' }))
        try {
            await supabase.from('sessions').update({ status: 'active' }).eq('id', sessionId)
            await fetchAllData()
        } catch (e) { console.error(e) }
        finally { setSaving(s => ({ ...s, [sessionId]: false })) }
    }

    async function markCompleted(sessionId) {
        setSaving(s => ({ ...s, [sessionId]: 'completing' }))
        try {
            await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId)
            await fetchSessions()
        } catch (e) { console.error(e) }
        finally { setSaving(s => ({ ...s, [sessionId]: false })) }
    }

    async function handleSaveReflection() {
        if (!activeReflectionSession) return
        setSaveStatus('saving')
        try {
            const { error } = await supabase.from('sessions').update({ ...reflectionForm }).eq('id', activeReflectionSession.id)
            if (error) throw error
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus(''), 2000)
        } catch (e) { setSaveStatus('error') }
    }

    async function handleMediaUpload(event, type) {
        const file = event.target.files[0]
        if (!file) return
        setUploading(prev => ({ ...prev, [type]: true }))
        try {
            const base64data = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = e => reject(e)
                reader.readAsDataURL(file)
            })
            const { error } = await supabase.from('profiles').update({ [`${type}_url`]: base64data }).eq('id', user.id)
            if (error) throw error
            
            if (refreshProfile) await refreshProfile(user.id)
            
            setSaveStatus('Media updated')
            setTimeout(() => setSaveStatus(''), 2000)
        } catch (err) {
            console.error(`Upload error for ${type}:`, err)
        } finally {
            setUploading(prev => ({ ...prev, [type]: false }))
            if (event.target) event.target.value = ''
        }
    }

    async function handleProfileSave() {
        setProfileSaving(true)
        try {
            const { error } = await supabase.from('profiles').update({
                full_name: profileForm.full_name,
                bio: profileForm.bio,
                phone: profileForm.phone,
            }).eq('id', user.id)
            if (error) throw error
            await refreshProfile(user.id)
            setProfileSaved(true)
            setTimeout(() => setProfileSaved(false), 2500)
        } catch (e) {
            console.error('Profile save error:', e)
        } finally {
            setProfileSaving(false)
        }
    }

    // --- SESSION FILTERING ---
    const upcoming = sessions.filter(s => s.status !== 'completed' && s.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    
    const past = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled')
        .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))

    const pendingNew = sessions.filter(s => s.status === 'paid' || s.status === 'pending')
    const completedSessions = sessions.filter(s => s.status === 'completed')
    const totalRevenue = completedSessions.reduce((acc, s) => acc + (s.price || 0), 0)

    // ---------- VIEWS ----------

    const renderOverview = () => (
        <div className="overview-container-arch fade-in">
            {/* Booking Alert Banner */}
            {pendingNew.length > 0 && (
                <div className="booking-alert-banner">
                    <span className="alert-icon">📬</span>
                    <div>
                        <strong>{pendingNew.length} New Booking{pendingNew.length > 1 ? 's' : ''} Awaiting Confirmation</strong>
                        <p>A mentee has paid and is waiting for your confirmation.</p>
                    </div>
                    <button className="btn-mentor-alert" onClick={() => setActiveView('schedule')}>View Schedule →</button>
                </div>
            )}

            {/* Banner & Profile Section */}
            <div className="profile-header-arch">
                <div className="hero-banner-arch" onClick={() => bannerInputRef.current?.click()}>
                    <img src={profile?.banner_url || "https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80"} alt="Banner" className="arch-banner-img" />
                    {uploading.banner && <div className="upload-overlay-arch">Uploading...</div>}
                </div>
                <div className="profile-overlay-circle" onClick={() => avatarInputRef.current?.click()}>
                    <img src={profile?.avatar_url || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80"} alt="Avatar" className="arch-avatar-img" />
                    <div className="avatar-edit-hint"><span>CHANGE</span></div>
                    {uploading.avatar && <div className="upload-overlay-arch">...</div>}
                </div>
            </div>
            <input type="file" ref={bannerInputRef} onChange={e => handleMediaUpload(e, 'banner')} style={{ display: 'none' }} accept="image/*" />
            <input type="file" ref={avatarInputRef} onChange={e => handleMediaUpload(e, 'avatar')} style={{ display: 'none' }} accept="image/*" />

            {/* Greeting Row */}
            <div className="bio-row-arch">
                <div className="mentor-welcome">
                    {!isVerified && (
                        <div className="verification-notice-arch">
                            <span>🕒 Your Mentor Profile is currently pending administrative review. We\'ll notify you once you\'re cleared to host sessions.</span>
                        </div>
                    )}
                    <h1>Welcome back, {profile?.full_name?.split(' ')[0] || 'Mentor'} 🌸</h1>
                    <p className="bio-p">{profile?.bio || 'Empowering growth and guiding the next generation.'}</p>
                </div>
                <div className="bio-stats-group">
                    <div className="stat-unit">
                        <span className="stat-value">{upcoming.length}</span>
                        <span className="stat-label">Active</span>
                    </div>
                    <div className="stat-unit">
                        <span className="stat-value">KES {totalRevenue.toLocaleString()}</span>
                        <span className="stat-label">Earnings</span>
                    </div>
                </div>
                <div className="bio-actions">
                    <button className="join-demo-btn-arch" onClick={() => setActiveVideoSession({ profiles: { full_name: 'Mentee Demo' }, session_label: 'Instant Meeting' })}>
                        📅 INSTANT MEETING
                    </button>
                    <button className="edit-profile-btn-arch" onClick={() => setActiveView('settings')}>EDIT PROFILE</button>
                </div>
            </div>

            {/* Info Cards */}
            <div className="info-cards-row-arch">
                <div className="arch-card info-card">
                    <span className="card-label-arch">Member Since:</span>
                    <div className="card-content-arch">
                        <span className="icon-arch">🕒</span>
                        <span className="value-arch">
                            {profile?.created_at ? `${Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24 * 30))} months ago` : 'New Mentor'}
                        </span>
                    </div>
                </div>
                <div className="arch-card info-card text-center">
                    <span className="card-label-arch">Your Energy:</span>
                    <div className="card-content-arch mood-selector-arch">
                        {['🔋', '🧘', '🚀', '☕'].map(m => (
                            <button key={m} className={`mood-btn-arch ${selectedMood === m ? 'active' : ''}`} onClick={() => setSelectedMood(m)}>{m}</button>
                        ))}
                    </div>
                </div>
                <div className="arch-card info-card verse-card">
                    <span className="card-label-arch">Wisdom of the Day:</span>
                    <div className="verse-content-arch">
                        <p className="verse-text">"{votd.text}"</p>
                        <span className="verse-ref">— {votd.reference}</span>
                    </div>
                </div>
            </div>

            {/* Bento Row */}
            <div className="bento-row-arch">
                <div className="arch-card schedule-card-arch">
                    <div className="schedule-header">
                        <div className="date-badge-arch">
                            <span className="month">{upcoming[0] ? new Date(upcoming[0].scheduled_at).toLocaleString('default', { month: 'short' }).toUpperCase() : '---'}</span>
                            <span className="day">{upcoming[0] ? new Date(upcoming[0].scheduled_at).getDate() : '--'}</span>
                        </div>
                        <h3>Next Up</h3>
                    </div>
                    <div className="schedule-body">
                        {loading ? <p className="empty-msg-arch">Loading...</p> : upcoming.length === 0 ? (
                            <p className="empty-msg-arch">No upcoming sessions.</p>
                        ) : (
                            <div className="mini-session">
                                <strong>With {upcoming[0].profiles?.full_name || 'Mentee'}</strong>
                                <span>{upcoming[0].session_label || upcoming[0].session_type}</span>
                                <span>{new Date(upcoming[0].scheduled_at).toLocaleString()}</span>
                            </div>
                        )}
                        <button className="book-btn-arch" onClick={() => setActiveView('schedule')}>View Full Schedule</button>
                    </div>
                </div>

                <div className="arch-card reflection-card-arch">
                    <div className="reflection-header">
                        <h3>Session Notes</h3>
                        <span className="subtitle-arch">Mentee: {activeReflectionSession?.profiles?.full_name || 'No past session yet'}</span>
                    </div>
                    <div className="reflection-body-arch">
                        <textarea
                            className="reflection-textarea-arch"
                            placeholder="Key takeaways from your last session..."
                            value={reflectionForm.notes}
                            onChange={e => setReflectionForm(prev => ({ ...prev, notes: e.target.value }))}
                        />
                        <button className="save-reflection-btn-arch" onClick={handleSaveReflection}>
                            {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'saved' ? 'SAVED ✓' : 'SAVE NOTES'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderSchedule = () => (
        <div className="workspace-module fade-in" style={{ padding: '1.5rem 4rem 3rem' }}>
            <div className="module-header-mentor">
                <div>
                    <h2>My Schedule</h2>
                    <p className="subtitle-arch">All your mentee bookings, past and upcoming.</p>
                </div>
                {pendingNew.length > 0 && (
                    <div className="pending-badge-large">
                        {pendingNew.length} Awaiting Confirmation
                    </div>
                )}
            </div>

            <h3 className="section-heading">Upcoming & Active</h3>
            <div className="sessions-list-mentor">
                {loading ? <p className="empty-msg-arch">Loading sessions...</p>
                    : upcoming.length === 0 ? <div className="empty-state-mentor"><span>📅</span><p>No active sessions.</p></div>
                    : upcoming.map(s => {
                        const isPastDue = new Date(s.scheduled_at) < new Date()
                        return (
                            <div key={s.id} className={`session-card-mentor ${s.status} ${isPastDue ? 'past-due' : ''}`}>
                                <div className="session-card-left">
                                    <div className="mentee-avatar-sm">
                                        {s.profiles?.avatar_url
                                            ? <img src={s.profiles.avatar_url} alt="" />
                                            : <span>{s.profiles?.full_name?.[0] || 'M'}</span>}
                                    </div>
                                    <div className="session-card-info">
                                        <div className="card-title-row">
                                            <h4>{s.profiles?.full_name || 'Mentee'}</h4>
                                            {isPastDue && <span className="past-due-badge">HELD?</span>}
                                        </div>
                                        <p>{s.session_label || s.session_type}</p>
                                        <p className="session-time-arch">
                                            📅 {new Date(s.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at {new Date(s.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="session-card-right">
                                    <span className="price-tag-mentor">KES {(s.price || 0).toLocaleString()}</span>
                                    <span className={`status-badge ${s.status}`}>{s.status.toUpperCase()}</span>
                                    <div className="session-btns">
                                        {s.status === 'paid' && (
                                            <button className="btn-mentor btn-mentor-primary" onClick={() => confirmBooking(s.id)} disabled={!!saving[s.id]}>
                                                {saving[s.id] ? '...' : '✓ CONFIRM'}
                                            </button>
                                        )}
                                        {s.status === 'active' && isJoinable(s.scheduled_at) && (
                                            <button className="btn-mentor btn-mentor-primary" onClick={() => setActiveVideoSession(s)}>
                                                🎥 JOIN NOW
                                            </button>
                                        )}
                                        {s.status === 'active' && !isJoinable(s.scheduled_at) && (
                                            <button className="btn-mentor btn-mentor-outline" onClick={() => markCompleted(s.id)} disabled={!!saving[s.id]}>
                                                {saving[s.id] ? '...' : 'Mark Completed'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
            </div>

            <h3 className="section-heading" style={{ marginTop: '3rem' }}>History</h3>
            <div className="sessions-list-mentor">
                {past.length === 0
                    ? <div className="empty-state-mentor"><span>✅</span><p>No past sessions yet.</p></div>
                    : past.map(s => (
                        <div key={s.id} className={`session-card-mentor ${s.status}`}>
                            <div className="session-card-left">
                                <div className="mentee-avatar-sm">
                                    {s.profiles?.avatar_url
                                        ? <img src={s.profiles.avatar_url} alt="" />
                                        : <span>{s.profiles?.full_name?.[0] || 'M'}</span>}
                                </div>
                                <div className="session-card-info">
                                    <h4>{s.profiles?.full_name || 'Mentee'}</h4>
                                    <p>{s.session_label || s.session_type}</p>
                                    <p className="session-time-arch">
                                        {new Date(s.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <div className="session-card-right">
                                <span className="price-tag-mentor">KES {(s.price || 0).toLocaleString()}</span>
                                <span className={`status-badge ${s.status}`}>{s.status.toUpperCase()}</span>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    )

    const renderEarnings = () => {
        const monthlyRevenue = {}
        sessions.forEach(s => {
            if (!s.price || s.status !== 'completed') return
            const month = new Date(s.scheduled_at).toLocaleString('default', { month: 'short', year: 'numeric' })
            monthlyRevenue[month] = (monthlyRevenue[month] || 0) + s.price
        })
        const maxRevenue = Math.max(...Object.values(monthlyRevenue), 1)

        return (
            <div className="workspace-module fade-in" style={{ padding: '1.5rem 4rem 3rem' }}>
                <div className="module-header-mentor">
                    <div>
                        <h2>My Earnings</h2>
                        <p className="subtitle-arch">Revenue from your completed sessions.</p>
                    </div>
                </div>

                <div className="earnings-stats-row">
                    <div className="earnings-stat-card accent">
                        <span className="earnings-stat-icon">💰</span>
                        <div>
                            <span className="earnings-stat-value">KES {totalRevenue.toLocaleString()}</span>
                            <span className="earnings-stat-label">Total Revenue</span>
                        </div>
                    </div>
                    <div className="earnings-stat-card">
                        <span className="earnings-stat-icon">✅</span>
                        <div>
                            <span className="earnings-stat-value">{completedSessions.length}</span>
                            <span className="earnings-stat-label">Completed Sessions</span>
                        </div>
                    </div>
                    <div className="earnings-stat-card">
                        <span className="earnings-stat-icon">📅</span>
                        <div>
                            <span className="earnings-stat-value">{upcoming.length}</span>
                            <span className="earnings-stat-label">Active Bookings</span>
                        </div>
                    </div>
                </div>

                {Object.keys(monthlyRevenue).length > 0 && (
                    <div className="arch-card" style={{ marginBottom: '2rem' }}>
                        <span className="card-label-arch">Monthly Revenue Breakdown</span>
                        <div className="revenue-chart">
                            {Object.entries(monthlyRevenue).map(([month, amount]) => (
                                <div key={month} className="revenue-bar-col">
                                    <div className="revenue-bar-wrap">
                                        <div className="revenue-bar" style={{ height: `${(amount / maxRevenue) * 100}%` }}>
                                            <span className="revenue-bar-tooltip">KES {amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <span className="revenue-bar-label">{month}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="arch-card">
                    <span className="card-label-arch">Session Ledger</span>
                    <table className="earnings-table">
                        <thead>
                            <tr>
                                <th>Mentee</th>
                                <th>Session</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No sessions found.</td></tr>
                            ) : [...sessions].sort((a,b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).map(s => (
                                <tr key={s.id}>
                                    <td>{s.profiles?.full_name || 'Mentee'}</td>
                                    <td>{s.session_label || s.session_type}</td>
                                    <td>{new Date(s.scheduled_at).toLocaleDateString()}</td>
                                    <td><span className={`status-badge ${s.status}`}>{s.status.toUpperCase()}</span></td>
                                    <td className="amount-cell">KES {(s.price || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4} className="total-label">Projected Total</td>
                                <td className="amount-cell total-value">KES {sessions.reduce((acc, s) => acc + (s.price || 0), 0).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        )
    }

    const renderSettings = () => (
        <div className="workspace-module fade-in" style={{ padding: '1.5rem 4rem 3rem' }}>
            <div className="module-header-mentor">
                <div>
                    <h2>Profile Settings</h2>
                    <p className="subtitle-arch">Update your public mentor profile.</p>
                </div>
            </div>

            <div className="settings-grid">
                <div className="arch-card settings-media-card">
                    <span className="card-label-arch">Profile Photos</span>
                    <div className="settings-avatar-preview">
                        <img src={profile?.avatar_url || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80"} alt="avatar" className="settings-avatar-img" />
                        <div className="settings-avatar-actions">
                            <button className="btn-mentor btn-mentor-outline" onClick={() => avatarInputRef.current?.click()}>
                                {uploading.avatar ? 'Uploading...' : '📷 Change Avatar'}
                            </button>
                            <button className="btn-mentor btn-mentor-outline" onClick={() => bannerInputRef.current?.click()}>
                                {uploading.banner ? 'Uploading...' : '🖼 Change Banner'}
                            </button>
                        </div>
                    </div>
                    <input type="file" ref={bannerInputRef} onChange={e => handleMediaUpload(e, 'banner')} style={{ display: 'none' }} accept="image/*" />
                    <input type="file" ref={avatarInputRef} onChange={e => handleMediaUpload(e, 'avatar')} style={{ display: 'none' }} accept="image/*" />
                </div>

                <div className="arch-card settings-form-card">
                    <span className="card-label-arch">Account Details</span>
                    <div className="settings-form">
                        <div className="settings-field">
                            <label>Full Name</label>
                            <input type="text" className="settings-input" value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" />
                        </div>
                        <div className="settings-field">
                            <label>Email Address</label>
                            <input type="text" className="settings-input" value={user?.email || ''} disabled style={{ opacity: 0.5 }} />
                        </div>
                        <div className="settings-field">
                            <label>Phone</label>
                            <input type="tel" className="settings-input" value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254 700 000 000" />
                        </div>
                        <div className="settings-field">
                            <label>Bio / About Me</label>
                            <textarea className="settings-textarea" rows={4} value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} placeholder="Tell mentees about your expertise and approach..." />
                        </div>
                        <button className="save-reflection-btn-arch" style={{ alignSelf: 'flex-start' }} onClick={handleProfileSave} disabled={profileSaving}>
                            {profileSaving ? 'SAVING...' : profileSaved ? 'SAVED ✓' : 'SAVE CHANGES'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderView = () => {
        switch (activeView) {
            case 'schedule': return renderSchedule()
            case 'earnings': return renderEarnings()
            case 'settings': return renderSettings()
            case 'overview':
            default: return renderOverview()
        }
    }

    return (
        <div className="mentor-dashboard-page-arch">
            <main className="dashboard-main-mentor" style={{ borderTop: 'none' }}>
                {renderView()}
            </main>

            {activeVideoSession && (
                <VideoCallModal 
                    session={activeVideoSession} 
                    onClose={() => setActiveVideoSession(null)} 
                />
            )}
        </div>
    )
}
