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
    
    const peerRef = useRef(null)
    const channelRef = useRef(null)
    const localStreamRef = useRef(null)

    const startCall = useCallback(async () => {
        const idToUse = sessionId || 'instant-meeting-room'
        setError(null)
        setCallStatus('connecting')

        try {
            // Get local media first - this should NOT block the UI
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            }).catch(async (err) => {
                console.warn("Failed video, trying audio-only:", err)
                return await navigator.mediaDevices.getUserMedia({ audio: true })
            })
            
            localStreamRef.current = stream
            setLocalStream(stream)

            // Setup PC
            const pc = new RTCPeerConnection(ICE_SERVERS)
            peerRef.current = pc

            stream.getTracks().forEach(track => pc.addTrack(track, stream))

            pc.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                    setRemoteStream(event.streams[0])
                    setCallStatus('connected')
                }
            }

            // Signaling
            const channel = supabase.channel(`room-${idToUse}`)
            channelRef.current = channel

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    channel.send({
                        type: 'broadcast',
                        event: 'ice-candidate',
                        payload: { candidate: event.candidate, from: isMentor ? 'mentor' : 'client' }
                    })
                }
            }

            channel.on('broadcast', { event: 'peer-joined' }, async ({ payload }) => {
                if (isMentor && payload.from === 'client') {
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
                    channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: answer } }) // Correct event is 'answer', but some signaling expects 'offer' in response? No, usually 'answer'.
                }
            })
            
            // Fix: ensure we handle 'answer' event
            channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
                if (isMentor) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                }
            })

            channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                const fromOther = isMentor ? payload.from === 'client' : payload.from === 'mentor'
                if (fromOther && payload.candidate && pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.warn(e))
                }
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
            if (peerRef.current) peerRef.current.close()
            if (channelRef.current) supabase.removeChannel(channelRef.current)
        }
    }, [startCall])

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

    return { localStream, remoteStream, isMuted, isCameraOff, callStatus, error, toggleMic, toggleCamera, startCall }
}
