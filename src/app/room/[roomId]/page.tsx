'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import RoomJoin from '@/components/RoomJoin';
import ChatRoom from '@/components/ChatRoom';

export default function RoomPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const [isJoined, setIsJoined] = useState(false);
  
  // Extract roomId from Next.js dynamic route parameters
  const roomId = params?.roomId as string || '';

  // Try to get user info from URL params first, then fall back to localStorage
  const [userName, setUserName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    console.log('🔄 ROOM PAGE REFRESH DETECTED');
    console.log('📍 Current URL:', window.location.href);
    console.log('🔍 Current pathname:', window.location.pathname);
    console.log('📊 Current search params:', searchParams.toString());
    console.log('🏠 Room ID:', roomId);
    console.log('🗂️ localStorage keys:', Object.keys(localStorage).filter(key => key.startsWith(`room_${roomId}`)));
    
    // Try URL params first
    const urlName = searchParams.get('name') || '';
    const urlPasscode = searchParams.get('passcode') || '';
    const urlIsOwner = searchParams.get('owner') === 'true';
    
    console.log('🔍 RoomPage useEffect triggered:', { urlName, urlPasscode, urlIsOwner, roomId });
    
    if (urlName && urlPasscode) {
      console.log('📤 Using URL params and storing in localStorage');
      // Store in localStorage for persistence
      localStorage.setItem(`room_${roomId}_name`, urlName);
      localStorage.setItem(`room_${roomId}_passcode`, urlPasscode);
      localStorage.setItem(`room_${roomId}_isOwner`, String(urlIsOwner));
      
      setUserName(urlName);
      setPasscode(urlPasscode);
      setIsOwner(urlIsOwner);
      setIsJoined(true);
      console.log('✅ Set from URL params:', { userName: urlName, passcode: urlPasscode, isOwner: urlIsOwner });
    } else {
      console.log('🔍 Falling back to localStorage for persistence');
      // Fall back to localStorage for persistence across refreshes
      const storedName = localStorage.getItem(`room_${roomId}_name`) || '';
      const storedPasscode = localStorage.getItem(`room_${roomId}_passcode`) || '';
      const storedIsOwner = localStorage.getItem(`room_${roomId}_isOwner`) === 'true';
      
      console.log('📋 LocalStorage data:', { storedName, storedPasscode, storedIsOwner });
      
      if (storedName && storedPasscode) {
        setUserName(storedName);
        setPasscode(storedPasscode);
        setIsOwner(storedIsOwner);
        setIsJoined(true);
        console.log('✅ Set from localStorage:', { userName: storedName, passcode: storedPasscode, isOwner: storedIsOwner });
        
        // Force rejoin with stored credentials to get current room state
        console.log('🔄 Forcing rejoin with stored credentials to get current room state');
        // This will trigger the room join process in the ChatRoom component
      } else {
        console.log('❌ No credentials found - showing join form');
      }
    }
  }, [searchParams, roomId]);

  // Cleanup stored room data when component unmounts or user leaves
  useEffect(() => {
    return () => {
      // Clean up room-specific data when leaving
      localStorage.removeItem(`room_${roomId}_name`);
      localStorage.removeItem(`room_${roomId}_passcode`);
      localStorage.removeItem(`room_${roomId}_isOwner`);
    };
  }, [roomId]);

  if (!isJoined) {
    return <RoomJoin roomId={roomId} />;
  }

  return (
    <ChatRoom 
      roomId={roomId} 
      userName={userName} 
      passcode={passcode}
      isOwner={isOwner}
    />
  );
}