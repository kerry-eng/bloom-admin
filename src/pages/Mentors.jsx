import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export default function Mentors() {
    const { isSuperAdmin } = useAuth()
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [newMentor, setNewMentor] = useState({ email: '' })
    const [editForm, setEditForm] = useState({ full_name: '', bio: '', expertise: '' })
    const [activeTab, setActiveTab] = useState('verified')

    useEffect(() => {
        if (isSuperAdmin) {
            fetchMentors()
        }
    }, [isSuperAdmin])

    async function fetchMentors() {
        setLoading(true)
        console.log('Fetching mentors for role = mentor...')
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'mentor')
            .order('created_at', { ascending: false })

        console.log('Mentors data:', data)
        if (error) console.error('Supabase query error:', error)
        
        if (!error) setMentors(data || [])
        setLoading(false)
    }

    async function handleAddMentor(e) {
        e.preventDefault()
        setAdding(true)
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', newMentor.email)
            .single()

        if (!existingUser) {
            alert('Error: No user found with this email. They must sign up on Bloom first.')
            setAdding(false)
            return
        }

        const { error } = await supabase
            .from('profiles')
            .update({ role: 'mentor', verification_status: 'pending' })
            .eq('id', existingUser.id)

        if (error) {
            alert('Error: ' + error.message)
        } else {
            alert('Mentor added with PENDING status. 🌸')
            fetchMentors()
            setNewMentor({ email: '' })
            setActiveTab('pending')
        }
        setAdding(false)
    }

    async function verifyMentor(mentorId) {
        const { error } = await supabase
            .from('profiles')
            .update({ verification_status: 'verified' })
            .eq('id', mentorId)

        if (!error) fetchMentors()
    }

    async function toggleFlagMentor(mentorId, currentFlag) {
        const { error } = await supabase
            .from('profiles')
            .update({ is_flagged: !currentFlag })
            .eq('id', mentorId)

        if (!error) fetchMentors()
    }

    async function revokeMentorAccess(mentorId) {
        if (!window.confirm('Revoke mentor access and demote to client?')) return
        const { error } = await supabase
            .from('profiles')
            .update({ role: 'client', verification_status: 'none', is_flagged: false })
            .eq('id', mentorId)

        if (!error) fetchMentors()
    }

    async function handleUpdateMentor(e) {
        e.preventDefault()
        const expertiseArray = editForm.expertise.split(',').map(s => s.trim()).filter(Boolean)
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: editForm.full_name, bio: editForm.bio, expertise: expertiseArray })
            .eq('id', editingId)

        if (!error) {
            setEditingId(null)
            fetchMentors()
        }
    }

    const verifiedMentors = mentors.filter(m => m.verification_status === 'verified' && !m.is_flagged)
    const pendingMentors = mentors.filter(m => m.verification_status !== 'verified' && !m.is_flagged)
    const flaggedMentors = mentors.filter(m => m.is_flagged)

    const mentorsToDisplay = 
        activeTab === 'verified' ? verifiedMentors : 
        activeTab === 'pending' ? pendingMentors : 
        flaggedMentors

    if (!isSuperAdmin) {
        return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>403 Forbidden</div>
    }

    return (
        <div className="container mentor__container fade-in">
            <div className="mentor__header">
                <div>
                    <p className="section-label">Trust & Safety</p>
                    <h1 className="mentor__title">Mentor Verification 🔍</h1>
                    <p style={{ color: 'var(--color-text-soft)' }}>Verify and manage onboarding for Bloom's mentors.</p>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1.2fr 2.8fr', gap: '2rem' }}>
                <aside>
                    <div className="glass-card" style={{ marginBottom: '2rem' }}>
                        <h3>Onboard Mentor</h3>
                        <form onSubmit={handleAddMentor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <input
                                type="email"
                                placeholder="Enter Email Address"
                                className="input"
                                value={newMentor.email}
                                onChange={e => setNewMentor({ email: e.target.value })}
                                required
                            />
                            <button type="submit" className="btn btn-primary" disabled={adding}>
                                {adding ? 'Processing...' : 'Add as Pending'}
                            </button>
                        </form>
                    </div>

                    {editingId && (
                        <div className="glass-card fade-in">
                            <h3>Edit Profile</h3>
                            <form onSubmit={handleUpdateMentor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                <input className="input" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full Name" required />
                                <textarea className="input" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Bio" />
                                <input className="input" value={editForm.expertise} onChange={e => setEditForm({ ...editForm, expertise: e.target.value })} placeholder="Expertise (comma separated)" />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>Save</button>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}
                </aside>

                <div className="glass-card">
                    <div className="tabs-arch" style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
                        <button className={`tab-btn ${activeTab === 'verified' ? 'active' : ''}`} onClick={() => setActiveTab('verified')}>
                            Verified ({verifiedMentors.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                            Pending ({pendingMentors.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'flagged' ? 'active' : ''}`} onClick={() => setActiveTab('flagged')} style={{ color: flaggedMentors.length > 0 ? '#ef4444' : 'inherit' }}>
                            Flagged ({flaggedMentors.length})
                        </button>
                    </div>

                    <div className="mentor-list">
                        {loading ? <p>Loading...</p> : mentorsToDisplay.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-soft)' }}>
                                No {activeTab} mentors found.
                            </p>
                        ) : (
                            <table style={{ width: '100%' }}>
                                <thead style={{ textAlign: 'left', color: 'var(--color-text-soft)', fontSize: '0.8rem' }}>
                                    <tr>
                                        <th>Name / Email</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mentorsToDisplay.map(m => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem 0' }}>
                                                <div style={{ fontWeight: 600 }}>{m.full_name || 'Incomplete Profile'}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{m.email}</div>
                                            </td>
                                            <td>
                                                {m.verification_status === 'verified' ? (
                                                    <span className="badge badge-success">VERIFIED MEMBER</span>
                                                ) : (
                                                    <span className="badge badge-warning">PENDING REVIEW</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {m.verification_status !== 'verified' && (
                                                        <button className="btn btn-primary btn-sm" onClick={() => verifyMentor(m.id)}>✅ APPROVE</button>
                                                    )}
                                                    <button className="btn btn-secondary btn-sm" onClick={() => {
                                                        setEditingId(m.id)
                                                        setEditForm({ full_name: m.full_name || '', bio: m.bio || '', expertise: (m.expertise || []).join(', ') })
                                                    }}>✏️</button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => toggleFlagMentor(m.id, m.is_flagged)}>{m.is_flagged ? '🏳️' : '🚩'}</button>
                                                    <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => revokeMentorAccess(m.id)}>🚫</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
