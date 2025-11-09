import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for rooms (replace with database in production)
const rooms = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { message: 'No token provided' },
        { status: 401 }
      );
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }

    const { userName, passcode } = await request.json();

    if (!userName || !passcode) {
      return NextResponse.json(
        { message: 'User name and passcode are required' },
        { status: 400 }
      );
    }

    // Create room
    const roomId = uuidv4().substring(0, 8).toUpperCase();
    const room = {
      id: roomId,
      passcode: passcode,
      createdAt: new Date().toISOString(),
      createdBy: decoded.userId || decoded.email,
      users: [],
      messages: []
    };

    rooms.set(roomId, room);

    return NextResponse.json({
      message: 'Room created successfully',
      roomId,
      passcode,
      shareUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/room/${roomId}`
    });

  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}