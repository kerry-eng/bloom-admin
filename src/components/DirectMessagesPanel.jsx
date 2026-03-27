import { useEffect, useRef, useState } from 'react'
import './DirectMessagesPanel.css'

function formatTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })
}

function formatDateLabel(value) {
    if (!value) return ''

    const date = new Date(value)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    })
}

function getInitials(name = '') {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'M'
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function isSetupError(error) {
    const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
    return error?.code === '42P01' || message.includes('direct_messages')
}

export default function DirectMessagesPanel({
    supabase,
    userId,
    threads = [],
    emptyHeading = 'No mentor conversation yet',
    emptyCopy = 'Book a session first to unlock direct messaging.',
    setupHint = 'Run add_direct_messages.sql in Supabase to enable direct messaging.'
}) {
    const [selectedThreadKey, setSelectedThreadKey] = useState(threads[0]?.key || null)
    const [messages, setMessages] = useState([])
    const [draft, setDraft] = useState('')
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [sending, setSending] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [setupRequired, setSetupRequired] = useState(false)
    const endRef = useRef(null)

    const selectedThread = threads.find(thread => thread.key === selectedThreadKey) || null

    useEffect(() => {
        if (threads.length === 0) {
            setSelectedThreadKey(null)
            return
        }

        const hasSelectedThread = threads.some(thread => thread.key === selectedThreadKey)
        if (!hasSelectedThread) {
            setSelectedThreadKey(threads[0].key)
        }
    }, [threads, selectedThreadKey])

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (!selectedThread || !supabase) {
            setMessages([])
            return
        }

        let isActive = true

        async function loadMessages() {
            setLoadingMessages(true)
            setErrorMessage('')

            const { data, error } = await supabase
                .from('direct_messages')
                .select('id, client_id, mentor_id, sender_id, content, created_at')
                .eq('client_id', selectedThread.clientId)
                .eq('mentor_id', selectedThread.mentorId)
                .order('created_at', { ascending: true })
                .limit(200)

            if (!isActive) return

            if (error) {
                if (isSetupError(error)) {
                    setSetupRequired(true)
                    setMessages([])
                    setErrorMessage('')
                } else {
                    setErrorMessage('Unable to load this conversation right now.')
                }
            } else {
                setSetupRequired(false)
                setMessages(data || [])
            }

            setLoadingMessages(false)
        }

        loadMessages()

        return () => {
            isActive = false
        }
    }, [selectedThread?.key, supabase])

    useEffect(() => {
        if (!userId || !supabase) return

        const channel = supabase
            .channel(`direct-messages-${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'direct_messages' },
                (payload) => {
                    const nextMessage = payload.new
                    if (!nextMessage) return

                    const isParticipant = nextMessage.client_id === userId || nextMessage.mentor_id === userId
                    if (!isParticipant) return

                    if (
                        selectedThread &&
                        nextMessage.client_id === selectedThread.clientId &&
                        nextMessage.mentor_id === selectedThread.mentorId
                    ) {
                        setMessages(current => {
                            if (current.some(message => message.id === nextMessage.id)) return current
                            return [...current, nextMessage]
                        })
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedThread?.key, selectedThread?.clientId, selectedThread?.mentorId, supabase, userId])

    async function handleSendMessage(event) {
        event.preventDefault()

        if (!draft.trim() || !selectedThread || sending || setupRequired) return

        setSending(true)
        setErrorMessage('')

        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                client_id: selectedThread.clientId,
                mentor_id: selectedThread.mentorId,
                sender_id: userId,
                content: draft.trim()
            })
            .select('id, client_id, mentor_id, sender_id, content, created_at')
            .single()

        if (error) {
            if (isSetupError(error)) {
                setSetupRequired(true)
                setErrorMessage(setupHint)
            } else {
                setErrorMessage(error.message || 'Unable to send your message right now.')
            }
        } else if (data) {
            setSetupRequired(false)
            setMessages(current => {
                if (current.some(message => message.id === data.id)) return current
                return [...current, data]
            })
            setDraft('')
        }

        setSending(false)
    }

    function handleComposerKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
        }
    }

    if (threads.length === 0) {
        return (
            <div className="direct-messages-shell direct-messages-shell--empty">
                <div className="direct-messages-empty">
                    <span className="direct-messages-empty__eyebrow">Messaging locked</span>
                    <h3>{emptyHeading}</h3>
                    <p>{emptyCopy}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="direct-messages-shell">
            <aside className="direct-messages-sidebar">
                <div className="direct-messages-sidebar__header">
                    <span className="direct-messages-sidebar__eyebrow">Conversations</span>
                    <h3>{threads.length} active thread{threads.length === 1 ? '' : 's'}</h3>
                    <p>Open any booked mentor relationship and send a direct note.</p>
                </div>

                <div className="direct-messages-thread-list">
                    {threads.map(thread => {
                        const isSelected = thread.key === selectedThreadKey
                        return (
                            <button
                                key={thread.key}
                                type="button"
                                className={`direct-messages-thread-card ${isSelected ? 'is-active' : ''}`}
                                onClick={() => setSelectedThreadKey(thread.key)}
                            >
                                <div className="direct-messages-thread-card__avatar">
                                    {thread.counterpartAvatar ? (
                                        <img src={thread.counterpartAvatar} alt={thread.counterpartName} />
                                    ) : (
                                        <span>{getInitials(thread.counterpartName)}</span>
                                    )}
                                </div>
                                <div className="direct-messages-thread-card__body">
                                    <div className="direct-messages-thread-card__topline">
                                        <strong>{thread.counterpartName}</strong>
                                        <span>{formatDateLabel(thread.latestSessionAt)}</span>
                                    </div>
                                    <p>{thread.metaLine || 'Mentorship conversation'}</p>
                                    <small>{thread.counterpartEmail || thread.secondaryLine || 'Message thread ready'}</small>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </aside>

            <section className="direct-messages-main">
                {selectedThread && (
                    <header className="direct-messages-main__header">
                        <div className="direct-messages-main__identity">
                            <div className="direct-messages-main__avatar">
                                {selectedThread.counterpartAvatar ? (
                                    <img src={selectedThread.counterpartAvatar} alt={selectedThread.counterpartName} />
                                ) : (
                                    <span>{getInitials(selectedThread.counterpartName)}</span>
                                )}
                            </div>
                            <div>
                                <span className="direct-messages-main__eyebrow">Direct thread</span>
                                <h3>{selectedThread.counterpartName}</h3>
                                <p>{selectedThread.metaLine || 'Mentorship conversation'}</p>
                            </div>
                        </div>
                        <div className="direct-messages-main__meta">
                            <span>{selectedThread.secondaryLine || selectedThread.counterpartEmail || 'Conversation open'}</span>
                            <strong>{formatDateLabel(selectedThread.latestSessionAt)}</strong>
                        </div>
                    </header>
                )}

                <div className="direct-messages-timeline">
                    {loadingMessages ? (
                        <div className="direct-messages-state">Loading conversation...</div>
                    ) : setupRequired ? (
                        <div className="direct-messages-state direct-messages-state--warning">
                            <strong>Messaging database not ready.</strong>
                            <p>{setupHint}</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="direct-messages-state">
                            <strong>No messages yet.</strong>
                            <p>Start the conversation and the thread will appear here instantly.</p>
                        </div>
                    ) : (
                        messages.map(message => {
                            const isOwnMessage = message.sender_id === userId
                            return (
                                <div
                                    key={message.id}
                                    className={`direct-message-row ${isOwnMessage ? 'is-own' : 'is-theirs'}`}
                                >
                                    <div className="direct-message-bubble">
                                        <p>{message.content}</p>
                                        <span>{formatTime(message.created_at)}</span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                    <div ref={endRef} />
                </div>

                <form className="direct-messages-composer" onSubmit={handleSendMessage}>
                    <label className="sr-only" htmlFor="direct-message-input">Type your message</label>
                    <textarea
                        id="direct-message-input"
                        className="direct-messages-composer__input"
                        rows="1"
                        placeholder={setupRequired ? 'Messaging setup required before sending.' : 'Type a message...'}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        disabled={setupRequired || sending}
                    />
                    <button
                        type="submit"
                        className="direct-messages-composer__send"
                        disabled={!draft.trim() || setupRequired || sending}
                    >
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </form>

                {errorMessage && <p className="direct-messages-error">{errorMessage}</p>}
            </section>
        </div>
    )
}
