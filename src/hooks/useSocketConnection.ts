import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

interface UseSocketConnectionProps {
    roomId: string;
    userName: string;
    passcode: string;
}

export function useSocketConnection({ roomId, userName, passcode }: UseSocketConnectionProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        const socket = getSocket();
        socketRef.current = socket;

        const handleConnect = () => {
            if (isMountedRef.current) setIsConnected(true);
        };

        const handleDisconnect = () => {
            if (isMountedRef.current) setIsConnected(false);
        };

        if (socket.connected) {
            setIsConnected(true);
        }

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        // Authentication and Join Logic
        const authenticateAndJoin = async () => {
            const token = localStorage.getItem('token');

            // Authenticate
            if (token) {
                socket.emit('authenticate', { token });
                await new Promise<void>((resolve) => {
                    const onAuthSuccess = () => {
                        socket.off('auth-success', onAuthSuccess);
                        socket.off('auth-error', onAuthError);
                        if (isMountedRef.current) setIsAuthenticated(true);
                        resolve();
                    };
                    const onAuthError = () => {
                        socket.off('auth-success', onAuthSuccess);
                        socket.off('auth-error', onAuthError);
                        resolve(); // Proceed as guest
                    };
                    socket.on('auth-success', onAuthSuccess);
                    socket.on('auth-error', onAuthError);
                    // Timeout fallback
                    setTimeout(() => {
                        socket.off('auth-success', onAuthSuccess);
                        socket.off('auth-error', onAuthError);
                        resolve();
                    }, 5000);
                });
            }

            // Join Room
            const persistentUserId = localStorage.getItem('socketUserId');
            socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
            if (isMountedRef.current) setHasJoined(true);
        };

        if (socket.connected) {
            authenticateAndJoin();
        } else {
            socket.once('connect', authenticateAndJoin);
            socket.connect();
        }

        return () => {
            isMountedRef.current = false;
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, [roomId, userName, passcode]);

    return { socket: socketRef.current, isConnected, isAuthenticated, hasJoined };
}
