import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
}

export function useWebRTC(sessionId, isMentor = false) {
    const [localStream, setLocalStream] = useState(null)
    const [remoteStream, setRemoteStream] = useState(null)
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [callStatus, setCallStatus] = useState('connecting')
    const [error, setError] = useState(null)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [messages, setMessages] = useState([])
    const screenStreamRef = useRef(null)
    
    const [needsRestart, setNeedsRestart] = useState(0)

    const peerRef = useRef(null)
    const channelRef = useRef(null)
    const localStreamRef = useRef(null)
    const dataChannelRef = useRef(null)
    const pendingCandidates = useRef([])

    // 1) Get and hold the local media stream permanently for the lifetime of this hook.
    useEffect(() => {
        let mounted = true
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .catch(async (err) => {
                console.warn("Failed video, trying audio-only:", err)
                return await navigator.mediaDevices.getUserMedia({ audio: true })
            })
            .then(stream => {
                if (mounted) {
                    localStreamRef.current = stream
                    setLocalStream(stream)
                } else {
                    stream.getTracks().forEach(t => t.stop())
                }
            })
            .catch(err => {
                console.error("Media access error:", err)
                if (mounted) {
                    setError('Camera/Mic access denied. Please allow permissions.')
                    setCallStatus('error')
                }
            })

        return () => {
            mounted = false
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop())
                localStreamRef.current = null
            }
        }
    }, [])

    const startCall = useCallback(async () => {
        if (!localStream) return // wait for media

        const idToUse = sessionId || 'instant-meeting-room'
        const myPeerId = isMentor ? 'mentor-signaler' : 'client-signaler'
        setError(null)
        setCallStatus('connecting')

        try {
            const pc = new RTCPeerConnection(ICE_SERVERS)
            peerRef.current = pc

            const setupDataChannel = (dc) => {
                dataChannelRef.current = dc
                dc.onmessage = (e) => {
                    try {
                        const msg = JSON.parse(e.data)
                        setMessages(prev => [...prev, msg])
                    } catch(err) { console.warn(err) }
                }
            }

            if (isMentor) {
                const dc = pc.createDataChannel('chat')
                setupDataChannel(dc)
            } else {
                pc.ondatachannel = (e) => setupDataChannel(e.channel)
            }

            localStream.getTracks().forEach(track => pc.addTrack(track, localStream))

            pc.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                    setRemoteStream(event.streams[0])
                    setCallStatus('connected')
                }
            }

            const channel = supabase.channel(`room-${idToUse}`)
            channelRef.current = channel

            pc.onicecandidate = (event) => {
                if (event.candidate && channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'ice-candidate',
                        payload: { candidate: event.candidate, from: myPeerId }
                    })
                }
            }

            const processPendingCandidates = async () => {
                while (pendingCandidates.current.length > 0) {
                    const candidate = pendingCandidates.current.shift()
                    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn("Lazy candidate error:", e))
                }
            }

            channel.on('broadcast', { event: 'peer-joined' }, async ({ payload }) => {
                console.log('SIGNAL: Peer joined', payload.from)
                if (payload.from !== myPeerId) {
                    if (pc.remoteDescription) {
                        console.log('SIGNAL: Other peer restarted! Restarting our connection seamlessly...')
                        setNeedsRestart(Date.now())
                        return
                    }

                    console.log('SIGNAL: Sending presence back')
                    channel.send({ type: 'broadcast', event: 'peer-presence', payload: { from: myPeerId } })
                    
                    if (isMentor) {
                        console.log('SIGNAL: I am Mentor, initiating Offer')
                        const offer = await pc.createOffer()
                        await pc.setLocalDescription(offer)
                        channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } })
                    }
                }
            })

            channel.on('broadcast', { event: 'peer-presence' }, async ({ payload }) => {
                console.log('SIGNAL: Peer presence', payload.from)
                if (payload.from !== myPeerId && isMentor && !pc.localDescription) {
                    console.log('SIGNAL: Mentor detected presence, initiating Offer')
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } })
                }
            })

            channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
                console.log('SIGNAL: Offer received')
                if (!isMentor && !pc.localDescription) {
                    console.log('SIGNAL: Client processing initial Offer')
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } })
                    processPendingCandidates()
                }
            })

            channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
                console.log('SIGNAL: Answer received')
                if (isMentor && pc.localDescription && !pc.remoteDescription) {
                    console.log('SIGNAL: Mentor processing Answer')
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    processPendingCandidates()
                }
            })

            channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                if (payload.from !== myPeerId && payload.candidate) {
                    if (pc.remoteDescription) {
                        console.log('SIGNAL: Adding remote candidate')
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.warn(e))
                    } else {
                        console.log('SIGNAL: Buffering remote candidate')
                        pendingCandidates.current.push(payload.candidate)
                    }
                }
            })

            channel.on('broadcast', { event: 'chat-msg' }, ({ payload }) => {
                setMessages(prev => [...prev, payload])
            })

            channel.subscribe((status) => {
                console.log('SIGNAL: Channel status:', status)
                if (status === 'SUBSCRIBED') {
                    console.log('SIGNAL: Subscribed, broadcasting joining')
                    channel.send({
                        type: 'broadcast',
                        event: 'peer-joined',
                        payload: { from: myPeerId }
                    })
                }
            })

        } catch (e) {
            console.error(e)
            setError(e.message)
            setCallStatus('error')
        }
    }, [sessionId, isMentor, localStream])

    useEffect(() => {
        if (!localStream) return
        startCall()
        return () => {
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(t => t.stop())
                screenStreamRef.current = null
            }
            if (peerRef.current) {
                peerRef.current.ontrack = null
                peerRef.current.onicecandidate = null
                peerRef.current.close()
                peerRef.current = null
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
            pendingCandidates.current = []
            // WE DO NOT STOP localStreamRef HERE, so it stays active across restarts!
        }
    }, [startCall, needsRestart, localStream])

    useEffect(() => {
        if (callStatus !== 'connecting' && callStatus !== 'idle') return
        const heartbeat = setInterval(() => {
            if (channelRef.current) {
                const myPeerId = isMentor ? 'mentor-signaler' : 'client-signaler'
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'peer-presence',
                    payload: { from: myPeerId }
                })
            }
        }, 3000)
        return () => clearInterval(heartbeat)
    }, [callStatus, isMentor])

    const toggleMic = () => {
        setIsMuted(m => {
            const next = !m
            localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !next)
            return next
        })
    }

    const toggleCamera = () => {
        setIsCameraOff(c => {
            const next = !c
            localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !next)
            return next
        })
    }

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0]
            const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video')
            if (sender) sender.replaceTrack(videoTrack)
            screenStreamRef.current?.getTracks().forEach(t => t.stop())
            screenStreamRef.current = null
            setIsScreenSharing(false)
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
                screenStreamRef.current = screenStream
                const screenTrack = screenStream.getVideoTracks()[0]
                const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video')
                if (sender) sender.replaceTrack(screenTrack)
                setIsScreenSharing(true)
                const handleStop = () => {
                    if (screenStreamRef.current) {
                        toggleScreenShare()
                    }
                }
                screenTrack.onended = handleStop
            } catch (e) {
                console.error("Screen share error:", e)
                alert("Screen sharing is not supported or was denied on this browser device.")
            }
        }
    }

    const sendMessage = (text, senderName) => {
        const msg = { text, sender: isMentor ? 'mentor' : 'client', senderName, timestamp: new Date().toISOString() }
        setMessages(prev => [...prev, msg])
        
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify(msg))
        } else {
            channelRef.current?.send({ type: 'broadcast', event: 'chat-msg', payload: msg })
        }
    }

    const endCall = () => {
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop())
        if (peerRef.current) peerRef.current.close()
        if (channelRef.current) supabase.removeChannel(channelRef.current)
        setLocalStream(null)
        setRemoteStream(null)
        setCallStatus('ended')
    }

    return { 
        localStream, remoteStream, isMuted, isCameraOff, isScreenSharing, messages,
        callStatus, error, toggleMic, toggleCamera, toggleScreenShare, sendMessage, 
        startCall, endCall 
    }
}
