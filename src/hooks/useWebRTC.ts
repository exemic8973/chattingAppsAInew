import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { EnhancedMultiPeerManager } from '@/lib/webrtc-enhanced';
import { CallState, User } from '@/types';

export function useWebRTC(socket: Socket | null, roomId: string) {
    const [callState, setCallState] = useState<CallState>({
        isCalling: false,
        isInCall: false,
        callType: null,
    });
    const [incomingCall, setIncomingCall] = useState<{
        fromUser: User;
        callType: 'voice' | 'video';
    } | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

    const webrtcManager = useRef<EnhancedMultiPeerManager | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!socket) return;

        webrtcManager.current = new EnhancedMultiPeerManager();

        // Signal handler
        webrtcManager.current.onSignal((payload) => {
            socket.emit('webrtc-signal', {
                roomId,
                signalData: payload.signalData,
                targetUserId: payload.to
            });
        });

        // Remote stream handler
        webrtcManager.current.onRemoteStream((remoteId, remoteStream, userName) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.set(remoteId, remoteStream);
                return newMap;
            });
            setCallState(prev => ({ ...prev, isCalling: false, isInCall: true }));
        });

        // Socket events for WebRTC
        const handleIncomingCall = ({ fromUser, callType }: { fromUser: User, callType: 'voice' | 'video' }) => {
            setIncomingCall({ fromUser, callType });
        };

        const handleCallAccepted = () => {
            setCallState(prev => ({ ...prev, isCalling: false, isInCall: true }));
        };

        const handleCallRejected = () => {
            setCallState(prev => ({ ...prev, isCalling: false }));
            alert('Call was rejected');
        };

        const handleCallEnded = () => {
            endCall(false); // Don't emit end-call again
        };

        const handleWebRTCSignal = ({ signalData, fromUserId }: { signalData: any, fromUserId: string }) => {
            webrtcManager.current?.signal(fromUserId, signalData);
        };

        socket.on('incoming-call', handleIncomingCall);
        socket.on('call-accepted', handleCallAccepted);
        socket.on('call-rejected', handleCallRejected);
        socket.on('call-ended', handleCallEnded);
        socket.on('webrtc-signal', handleWebRTCSignal);

        return () => {
            socket.off('incoming-call', handleIncomingCall);
            socket.off('call-accepted', handleCallAccepted);
            socket.off('call-rejected', handleCallRejected);
            socket.off('call-ended', handleCallEnded);
            socket.off('webrtc-signal', handleWebRTCSignal);
            webrtcManager.current?.cleanupAll();
        };
    }, [socket, roomId]);

    const startCall = async (callType: 'voice' | 'video') => {
        if (!webrtcManager.current || !socket) return;
        try {
            const stream = await webrtcManager.current.createLocalStream({
                video: callType === 'video',
                audio: true
            });
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            setCallState({ isCalling: true, isInCall: false, callType, localStream: stream });
            socket.emit('start-call', { roomId, callType });
        } catch (error) {
            console.error('Error starting call:', error);
            alert('Failed to start call.');
        }
    };

    const acceptCall = async () => {
        if (!incomingCall || !webrtcManager.current || !socket) return;
        try {
            const stream = await webrtcManager.current.createLocalStream({
                video: incomingCall.callType === 'video',
                audio: true
            });
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            setCallState({ isCalling: false, isInCall: true, callType: incomingCall.callType, localStream: stream });
            socket.emit('accept-call', { roomId, targetUserId: incomingCall.fromUser.id });
            setIncomingCall(null);
        } catch (error) {
            console.error('Error accepting call:', error);
        }
    };

    const rejectCall = () => {
        if (!incomingCall || !socket) return;
        socket.emit('call-rejected', { roomId, targetUserId: incomingCall.fromUser.id });
        setIncomingCall(null);
    };

    const endCall = (emit = true) => {
        if (callState.localStream) {
            callState.localStream.getTracks().forEach(track => track.stop());
        }
        webrtcManager.current?.cleanupAll();
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setRemoteStreams(new Map());

        setCallState({ isCalling: false, isInCall: false, callType: null });
        setIncomingCall(null);

        if (emit && socket) socket.emit('end-call', { roomId });
    };

    return {
        callState,
        incomingCall,
        localVideoRef,
        remoteVideoRef,
        remoteStreams,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        webrtcManager
    };
}
