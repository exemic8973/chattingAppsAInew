import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export function useRoomFeatures(socket: Socket | null, roomId: string) {
    const [isMuted, setIsMuted] = useState(true);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [hostMutedUsers, setHostMutedUsers] = useState<Set<string>>(new Set());
    const [isHostMuted, setIsHostMuted] = useState(false);
    const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
    const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
    const [activeReactions, setActiveReactions] = useState<Array<{ id: string, userId: string, reaction: string, timestamp: number }>>([]);
    const [screenSharingUser, setScreenSharingUser] = useState<string | null>(null);
    const [waitingParticipants, setWaitingParticipants] = useState<Array<{ id: string, name: string, timestamp: number }>>([]);
    const [connectionQuality, setConnectionQuality] = useState<Map<string, 'excellent' | 'good' | 'fair' | 'poor'>>(new Map());
    const [mutedParticipants, setMutedParticipants] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!socket) return;

        const handleMutedByHost = (data: any) => {
            setIsHostMuted(true);
            setIsMuted(true); // Force mute
        };

        const handleMuteStatus = (data: any) => {
            if (data.mutedByHost) {
                setHostMutedUsers(prev => {
                    const newSet = new Set(prev);
                    if (data.isMuted) newSet.add(data.userId);
                    else newSet.delete(data.userId);
                    return newSet;
                });
            }
            // Update general mute state
            setMutedParticipants(prev => {
                const newSet = new Set(prev);
                if (data.isMuted) newSet.add(data.userId);
                else newSet.delete(data.userId);
                return newSet;
            });
        };

        const handleSelfMuteStatus = (data: { isMuted: boolean, userId?: string }) => {
            const userId = data.userId;
            if (userId && typeof userId === 'string') {
                setMutedParticipants(prev => {
                    const newSet = new Set(prev);
                    if (data.isMuted) newSet.add(userId);
                    else newSet.delete(userId);
                    return newSet;
                });
            }
        };

        const handleJoinedWaiting = (data: any) => {
            setWaitingParticipants(prev => [...prev, { id: data.userId, name: data.userName, timestamp: data.timestamp }]);
        };

        const handleLeftWaiting = (data: any) => {
            setWaitingParticipants(prev => prev.filter(p => p.id !== data.userId));
        };

        const handleHandRaised = (data: any) => {
            setRaisedHands(prev => new Set(prev).add(data.userId));
        };

        const handleHandLowered = (data: any) => {
            setRaisedHands(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.userId);
                return newSet;
            });
        };

        const handleReaction = (data: any) => {
            const reactionId = `${data.userId}-${Date.now()}`;
            setActiveReactions(prev => [...prev, {
                id: reactionId,
                userId: data.userId,
                reaction: data.reaction,
                timestamp: data.timestamp
            }]);
            setTimeout(() => {
                setActiveReactions(prev => prev.filter(r => r.id !== reactionId));
            }, 3000);
        };

        const handleScreenShareStarted = (data: any) => setScreenSharingUser(data.userId);
        const handleScreenShareStopped = () => setScreenSharingUser(null);

        const handleSpeakingStatus = (data: any) => {
            setSpeakingParticipants(prev => {
                const newSet = new Set(prev);
                if (data.isSpeaking) newSet.add(data.userId);
                else newSet.delete(data.userId);
                return newSet;
            });
        };

        const handleConnectionQuality = (data: any) => {
            setConnectionQuality(prev => {
                const newMap = new Map(prev);
                newMap.set(data.userId, data.quality);
                return newMap;
            });
        };

        socket.on('participant-muted-by-host', handleMutedByHost);
        socket.on('participant-mute-status', handleMuteStatus);
        socket.on('mute-status', handleSelfMuteStatus);
        socket.on('participant-joined-waiting', handleJoinedWaiting);
        socket.on('participant-left-waiting', handleLeftWaiting);
        socket.on('hand-raised', handleHandRaised);
        socket.on('hand-lowered', handleHandLowered);
        socket.on('reaction-sent', handleReaction);
        socket.on('screen-share-started', handleScreenShareStarted);
        socket.on('screen-share-stopped', handleScreenShareStopped);
        socket.on('speaking-status', handleSpeakingStatus);
        socket.on('connection-quality', handleConnectionQuality);

        return () => {
            socket.off('participant-muted-by-host', handleMutedByHost);
            socket.off('participant-mute-status', handleMuteStatus);
            socket.off('mute-status', handleSelfMuteStatus);
            socket.off('participant-joined-waiting', handleJoinedWaiting);
            socket.off('participant-left-waiting', handleLeftWaiting);
            socket.off('hand-raised', handleHandRaised);
            socket.off('hand-lowered', handleHandLowered);
            socket.off('reaction-sent', handleReaction);
            socket.off('screen-share-started', handleScreenShareStarted);
            socket.off('screen-share-stopped', handleScreenShareStopped);
            socket.off('speaking-status', handleSpeakingStatus);
            socket.off('connection-quality', handleConnectionQuality);
        };
    }, [socket]);

    return {
        isMuted, setIsMuted,
        isVideoOff, setIsVideoOff,
        hostMutedUsers,
        isHostMuted,
        speakingParticipants,
        raisedHands,
        activeReactions,
        screenSharingUser,
        waitingParticipants,
        connectionQuality,
        setConnectionQuality,
        mutedParticipants
    };
}
