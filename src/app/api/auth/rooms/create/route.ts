import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// In-memory room storage (replace with database in production)
const rooms = new Map();

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userName, passcode } = await request.json();
    const user = authResult.user;

    if (!userName || !passcode) {
      return NextResponse.json(
        { message: 'User name and passcode are required' },
        { status: 400 }
      );
    }

    // Create room
    const roomId = uuidv4().substring(0, 8).toUpperCase();
    // Handle case where user might be undefined
    const createdBy = user?.id || 'unknown-user';
    
    const room = {
      id: roomId,
      passcode: passcode,
      createdAt: new Date(),
      createdBy: createdBy,
      users: [{
        id: 'temp-user-id',
        name: userName,
        isHost: true,
        peerId: null,
      }]
    };

    rooms.set(roomId, room);

    return NextResponse.json({
      message: 'Room created successfully',
      roomId,
      passcode,
      shareUrl: `${process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000'}/room/${roomId}`,
      room
    });

  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json(
      { message: 'Failed to create room' },
      { status: 500 }
    );
  }
}