import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export default function Mentors() {
    const { isSuperAdmin } = useAuth()
    const [mentors, setMentors] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [newMentor, setNewMentor] = useState({ full_name: '', email: '', role: 'mentor' })
    const [editForm, setEditForm] = useState({ full_name: '', bio: '', expertise: '' })

    useEffect(() => {
        if (isSuperAdmin) {
            fetchMentors()
        }
    }, [isSuperAdmin])

    async function fetchMentors() {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'mentor')
            .order('full_name', { ascending: true })

        if (!error) setMentors(data)
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
            alert('Error: No user found with this email. They must sign up on the main site first.')
            setAdding(false)
            return
        }

        const { error } = await supabase
            .from('profiles')
            .update({ role: 'mentor' })
            .eq('id', existingUser.id)

        if (error) {
            alert('Error updating user role: ' + error.message)
        } else {
            alert('User upgraded to Mentor successfully! 🌸')
            fetchMentors()
            setNewMentor({ full_name: '', email: '', role: 'mentor' })
        }
        setAdding(false)
    }

    async function handleUpdateMentor(e) {
        e.preventDefault()
        const expertiseArray = editForm.expertise.split(',').map(s => s.trim()).filter(s => s !== '')

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: editForm.full_name,
                bio: editForm.bio,
                expertise: expertiseArray
            })
            .eq('id', editingId)

        if (error) {
            alert('Error updating mentor: ' + error.message)
        } else {
            setEditingId(null)
            fetchMentors()
        }
    }

    function startEdit(mentor) {
        setEditingId(mentor.id)
        setEditForm({
            full_name: mentor.full_name || '',
            bio: mentor.bio || '',
            expertise: (mentor.expertise || []).join(', ')
        })
    }

    if (!isSuperAdmin) {
        return <div className="container">Access Denied. Super Admin only.</div>
    }

    return (
        <div className="container mentor__container fade-in">
            <div className="mentor__header">
                <div>
                    <p className="section-label">Administration</p>
                    <h1 className="mentor__title">Manage Mentors 🤝</h1>
                    <p style={{ color: 'var(--color-text-soft)' }}>Onboard and manage Bloom's mentorship team.</p>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 2.5fr', gap: '2rem' }}>
                <aside>
                    <div className="glass-card" style={{ marginBottom: '2rem' }}>
                        <h3>Add New Mentor</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-soft)', marginBottom: '1rem' }}>
                            Upgrade an existing student to Mentor status via their email.
                        </p>
                        <form onSubmit={handleAddMentor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="email"
                                placeholder="Mentor Email"
                                className="input"
                                value={newMentor.email}
                                onChange={e => setNewMentor({ ...newMentor, email: e.target.value })}
                                required
                            />
                            <button type="submit" className="btn btn-primary" disabled={adding}>
                                {adding ? 'Upgrading...' : 'Grant Mentor Access'}
                            </button>
                        </form>
                    </div>

                    {editingId && (
                        <div className="glass-card fade-in" style={{ border: '2px solid var(--color-lavender)' }}>
                            <h3>Edit Mentor Profile</h3>
                            <form onSubmit={handleUpdateMentor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                <div className="field">
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Name</label>
                                    <input
                                        className="input"
                                        value={editForm.full_name}
                                        onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="field">
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bio</label>
                                    <textarea
                                        className="input"
                                        rows="3"
                                        value={editForm.bio}
                                        onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                                        placeholder="Mentor's professional background..."
                                    />
                                </div>
                                <div className="field">
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Expertise (comma separated)</label>
                                    <input
                                        className="input"
                                        value={editForm.expertise}
                                        onChange={e => setEditForm({ ...editForm, expertise: e.target.value })}
                                        placeholder="Anxiety, Career, Relationships..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>Save Changes</button>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}
                </aside>

                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>Mentorship Team</h3>
                        <button className="btn btn-secondary btn-sm" onClick={fetchMentors}>Refresh</button>
                    </div>

                    {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>🌸 Loading mentors...</div> : (
                        <div className="mentor-list">
                            {mentors.length === 0 ? <p>No mentors onboarded yet.</p> : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ textAlign: 'left', borderBottom: '2px solid var(--color-lavender-light)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <tr>
                                            <th style={{ padding: '0.75rem' }}>Mentor Info</th>
                                            <th style={{ padding: '0.75rem' }}>Focus Areas</th>
                                            <th style={{ padding: '0.75rem' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mentors.map(m => (
                                            <tr key={m.id} style={{ borderBottom: '1px solid var(--color-lavender-light)' }}>
                                                <td style={{ padding: '1rem 0.75rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{m.full_name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-soft)' }}>{m.email}</div>
                                                </td>
                                                <td style={{ padding: '1rem 0.75rem' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                        {(m.expertise || []).map((exp, i) => (
                                                            <span key={i} className="badge badge-lavender" style={{ fontSize: '0.7rem' }}>{exp}</span>
                                                        ))}
                                                        {(!m.expertise || m.expertise.length === 0) && <span style={{ color: 'var(--color-text-soft)', fontStyle: 'italic', fontSize: '0.8rem' }}>None set</span>}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0.75rem' }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => startEdit(m)}
                                                        disabled={editingId === m.id}
                                                    >
                                                        Edit Profile
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
