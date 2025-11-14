'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import PreJoinScreen from '@/components/PreJoinScreen';
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
  const videoEnabled = searchParams.get('videoEnabled') === 'true';
  const audioEnabled = searchParams.get('audioEnabled') !== 'false'; // Default true

  useEffect(() => {
    if (userName && passcode) {
      setIsJoined(true);
    }
  }, [userName, passcode]);

  // Show pre-join screen if not joined
  if (!isJoined) {
    return <PreJoinScreen roomId={roomId} />;
  }

  // Show chat room once joined
  return (
    <ChatRoom
      roomId={roomId}
      userName={userName}
      passcode={passcode}
      isOwner={isOwner}
    />
  );
}