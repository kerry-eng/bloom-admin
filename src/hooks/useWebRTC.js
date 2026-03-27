import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
}

export function useWebRTC(sessionId, isMentor = true) {
    const [localStream, setLocalStream] = useState(null)
    const [remoteStream, setRemoteStream] = useState(null)
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [callStatus, setCallStatus] = useState('connecting')
    const [error, setError] = useState(null)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [messages, setMessages] = useState([])
    const screenStreamRef = useRef(null)
    
    const peerRef = useRef(null)
    const channelRef = useRef(null)
    const localStreamRef = useRef(null)
    const pendingCandidates = useRef([])

    const startCall = useCallback(async () => {
        const idToUse = sessionId || 'instant-meeting-room'
        setError(null)
        setCallStatus('connecting')

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            }).catch(async (err) => {
                console.warn("Failed video, trying audio-only:", err)
                return await navigator.mediaDevices.getUserMedia({ audio: true })
            })
            
            localStreamRef.current = stream
            setLocalStream(stream)

            const pc = new RTCPeerConnection(ICE_SERVERS)
            peerRef.current = pc

            stream.getTracks().forEach(track => pc.addTrack(track, stream))

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
                    channel.send({
                        type: 'broadcast',
                        event: 'ice-candidate',
                        payload: { candidate: event.candidate, from: isMentor ? 'mentor' : 'client' }
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
                channel.send({ type: 'broadcast', event: 'peer-presence', payload: { from: isMentor ? 'mentor' : 'client' } })
                if (isMentor && payload.from === 'client') {
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } })
                }
            })

            channel.on('broadcast', { event: 'peer-presence' }, async ({ payload }) => {
                if (isMentor && payload.from === 'client' && !pc.localDescription) {
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } })
                }
            })

            channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
                if (!isMentor) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } })
                    processPendingCandidates()
                }
            })

            channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
                if (isMentor) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    processPendingCandidates()
                }
            })

            channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                const fromOther = isMentor ? payload.from === 'client' : payload.from === 'mentor'
                if (fromOther && payload.candidate) {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.warn(e))
                    } else {
                        pendingCandidates.current.push(payload.candidate)
                    }
                }
            })

            channel.on('broadcast', { event: 'chat-msg' }, ({ payload }) => {
                setMessages(prev => [...prev, payload])
            })

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    channel.send({
                        type: 'broadcast',
                        event: 'peer-joined',
                        payload: { from: isMentor ? 'mentor' : 'client' }
                    })
                }
            })

        } catch (e) {
            console.error(e)
            setError(e.message)
            setCallStatus('error')
        }
    }, [sessionId, isMentor])

    useEffect(() => {
        startCall()
        return () => {
            if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop())
            if (peerRef.current) {
                peerRef.current.ontrack = null
                peerRef.current.onicecandidate = null
                peerRef.current.close()
            }
            if (channelRef.current) supabase.removeChannel(channelRef.current)
        }
    }, [startCall])

    useEffect(() => {
        if (callStatus !== 'connecting' && callStatus !== 'idle') return
        const heartbeat = setInterval(() => {
            if (channelRef.current) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'peer-presence',
                    payload: { from: isMentor ? 'mentor' : 'client' }
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
            }
        }
    }

    const sendMessage = (text, senderName) => {
        const msg = { text, sender: isMentor ? 'mentor' : 'client', senderName, timestamp: new Date().toISOString() }
        setMessages(prev => [...prev, msg])
        channelRef.current?.send({ type: 'broadcast', event: 'chat-msg', payload: msg })
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
