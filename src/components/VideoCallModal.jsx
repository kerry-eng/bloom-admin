import React, { useState, useEffect, useRef } from 'react'
import './VideoCallModal.css'

export default function VideoCallModal({ 
    session, 
    onClose, 
    localStream, 
    remoteStream, 
    isMuted, 
    isCameraOff, 
    toggleMic, 
    toggleCamera,
    callStatus,
    isMentor,
    isScreenSharing,
    toggleScreenShare,
    messages = [],
    sendMessage
}) {
    const [timer, setTimer] = useState(0)
    const [micLevel, setMicLevel] = useState(0)
    const [soundTest, setSoundTest] = useState(false)
    const [showChat, setShowChat] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [chatInput, setChatInput] = useState('')
    
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const audioContextRef = useRef(null)
    const analyzerRef = useRef(null)
    const animationFrameRef = useRef(null)
    const chatEndRef = useRef(null)

    useEffect(() => {
        if (showChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, showChat])

    useEffect(() => {
        let timerId
        if (callStatus === 'connected') {
            timerId = setInterval(() => setTimer(t => t + 1), 1000)
        }
        return () => clearInterval(timerId)
    }, [callStatus])

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream
            setupAudioAnalysis(localStream)
        }
    }, [localStream])

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('UI: Setting remote stream to video element')
            remoteVideoRef.current.srcObject = remoteStream
            remoteVideoRef.current.play().catch(e => console.warn("Auto-play blocked:", e))
        }
    }, [remoteStream])

    function setupAudioAnalysis(stream) {
        try {
            if (audioContextRef.current) audioContextRef.current.close()
            const audioContext = new (window.AudioContext || window.webkitAudioContext)()
            const source = audioContext.createMediaStreamSource(stream)
            const analyzer = audioContext.createAnalyser()
            analyzer.fftSize = 256
            source.connect(analyzer)
            
            audioContextRef.current = audioContext
            analyzerRef.current = analyzer

            const updateLevel = () => {
                if (!analyzerRef.current) return
                const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount)
                analyzerRef.current.getByteFrequencyData(dataArray)
                let sum = 0
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
                setMicLevel(sum / dataArray.length)
                animationFrameRef.current = requestAnimationFrame(updateLevel)
            }
            updateLevel()
        } catch (e) { console.warn(e) }
    }

    const handleSendChat = (e) => {
        e.preventDefault()
        if (!chatInput.trim()) return
        sendMessage(chatInput, isMentor ? 'Mentor' : 'Client')
        setChatInput('')
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="video-overlay">
            <div className="video-container">
                <div className="active-call-view">
                    <div className="video-main-area">
                        <div className="main-video-feed">
                            <video 
                                ref={remoteVideoRef} 
                                autoPlay 
                                playsInline 
                                className={`main-video-element ${!remoteStream ? 'hidden' : ''}`}
                            />

                            {!remoteStream && (
                                <div className="connecting-view-overlay">
                                    <div className="bloom-logo-pulse">🌸</div>
                                    <h2>{callStatus === 'connecting' ? 'Preparing Your Safe Space...' : 'Waiting for connection...'}</h2>
                                    <p>Waiting for {isMentor ? 'client' : 'mentor'} to join the room</p>
                                    
                                    <div className="mentee-avatar-placeholder" style={{ marginTop: '2rem' }}>
                                        <div className="placeholder-circle">
                                            <span>{isMentor ? 'C' : (session?.mentor?.full_name?.[0] || 'M')}</span>
                                        </div>
                                        <p>Ready for {isMentor ? 'client' : (session?.mentor?.full_name || 'Mentor')}</p>
                                    </div>
                                </div>
                            )}

                            {localStream && (
                                <div className="self-preview">
                                    <span className="video-label">YOU (LIVE)</span>
                                    <video 
                                        ref={localVideoRef} 
                                        autoPlay 
                                        muted={true} 
                                        playsInline 
                                        className={`self-video-element ${isCameraOff ? 'hidden' : ''}`} 
                                    />
                                    {isCameraOff && <div className="video-off-placeholder">CAMERA OFF</div>}
                                    
                                    {!isMuted && (
                                        <div className="mic-meter-container">
                                            <div className="mic-meter-fill" style={{ height: `${Math.min(micLevel * 1.5, 100)}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="call-footer">
                            <div className="call-info">
                                <span className="session-tag">{session?.session_label || 'Mentorship Session'}</span>
                                <span className="call-timer">{formatTime(timer)}</span>
                            </div>
                            
                            <div className="call-controls">
                                <div className="control-group">
                                    <button className={`control-btn ${isMuted ? 'disabled' : ''}`} onClick={toggleMic} title="Toggle Mute">
                                        <span className="icon">{isMuted ? '🔇' : '🎤'}</span>
                                    </button>
                                    <button className={`control-btn ${isCameraOff ? 'disabled' : ''}`} onClick={toggleCamera} title="Toggle Camera">
                                        <span className="icon">{isCameraOff ? '📵' : '📹'}</span>
                                    </button>
                                    <button className={`control-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title="Share Screen">
                                        <span className="icon">📺</span>
                                    </button>
                                </div>

                                <button className="control-btn end-call" onClick={onClose}>
                                    <span className="icon">📞</span>
                                    <span>LEAVE</span>
                                </button>

                                <div className="control-group">
                                    <button className={`control-btn ${showChat ? 'active' : ''}`} onClick={() => {setShowChat(!showChat); setShowSettings(false);}} title="Chat">
                                        <span className="icon">💬</span>
                                    </button>
                                    <button className={`control-btn ${showSettings ? 'active' : ''}`} onClick={() => {setShowSettings(!showSettings); setShowChat(false);}} title="Settings">
                                        <span className="icon">⚙️</span>
                                    </button>
                                </div>
                            </div>

                            <div className="security-badge">
                                🔒 Encrypted
                            </div>
                        </div>
                    </div>

                    {showSettings && (
                        <div className="settings-modal" style={{position: 'absolute', bottom: '90px', right: '20px', backgroundColor: 'var(--color-bg-elevated, #2a2a35)', border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '16px', zIndex: 100, color: 'white', maxWidth: '300px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'}}>
                            <h3 style={{marginTop: 0, marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem'}}>
                                Device Settings
                                <span style={{cursor:'pointer', color:'#aaa'}} onClick={() => setShowSettings(false)}>✕</span>
                            </h3>
                            <p style={{fontSize: '0.9rem', color: '#ccc', marginBottom: '1.2rem', lineHeight: 1.5}}>
                                To switch your active Camera or Microphone, please use the site settings menu (usually a lock icon <span style={{color:'white'}}>🔒</span> next to your browser's URL bar). Permissions and hardware are managed natively by your browser for maximum privacy.
                            </p>
                            <button className="btn w-100" style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, width: '100%'}} onClick={() => setShowSettings(false)}>Close</button>
                        </div>
                    )}

                    {/* Chat Sidebar */}
                    <div className={`chat-sidebar ${!showChat ? 'hidden' : ''}`}>
                        <div className="chat-header">
                            <span>SESSION CHAT</span>
                            <button className="close-chat" onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
                        </div>
                        <div className="chat-messages">
                            {messages.map((m, i) => (
                                <div key={i} className={`chat-bubble ${m.sender}`}>
                                    <div className="chat-sender">{m.senderName || m.sender}</div>
                                    <div className="chat-text">{m.text}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <form className="chat-input-area" onSubmit={handleSendChat}>
                            <input 
                                type="text" 
                                placeholder="Type a message..." 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                            />
                            <button type="submit" className="send-chat-btn">➔</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
