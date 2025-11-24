import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Message, User } from '@/types';

export function useChat(socket: Socket | null, roomId: string, userName: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomJoined = ({ users: roomUsers, messages: roomMessages }: { users: User[], messages: Message[] }) => {
            setUsers(roomUsers || []);
            // Deduplicate messages
            const uniqueMessages = (roomMessages || []).filter((msg, index, self) =>
                index === self.findIndex(m => m.id === msg.id)
            );
            setMessages(uniqueMessages);
        };

        const handleUserJoined = (data: { user: User }) => {
            if (!data.user) return;
            setUsers(prev => {
                if (prev.some(u => u.id === data.user.id)) return prev;
                return [...prev, data.user];
            });
        };

        const handleUserLeft = (data: { userName: string }) => {
            setUsers(prev => prev.filter(u => u.name !== data.userName));
        };

        const handleNewMessage = (message: Message) => {
            setMessages(prev => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
        };

        socket.on('room-joined', handleRoomJoined);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);
        socket.on('new-message', handleNewMessage);

        return () => {
            socket.off('room-joined', handleRoomJoined);
            socket.off('user-joined', handleUserJoined);
            socket.off('user-left', handleUserLeft);
            socket.off('new-message', handleNewMessage);
        };
    }, [socket, roomId]);

    const sendMessage = (content: string) => {
        if (!socket || !content.trim()) return;

        const messageId = `${socket.id}-${Date.now()}`;
        const localMessage: Message = {
            id: messageId,
            userName,
            content: content.trim(),
            timestamp: new Date(),
            userId: socket.id || '',
            type: 'text'
        };

        setMessages(prev => [...prev, localMessage]);
        socket.emit('chat-message', { roomId, message: content.trim(), messageId });
    };

    return { messages, users, sendMessage, setMessages, setUsers };
}
