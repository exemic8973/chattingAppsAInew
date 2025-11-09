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

  const userName = searchParams.get('name') || '';
  const passcode = searchParams.get('passcode') || '';
  const isOwner = searchParams.get('owner') === 'true';

  useEffect(() => {
    if (userName && passcode) {
      setIsJoined(true);
    }
  }, [userName, passcode]);

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