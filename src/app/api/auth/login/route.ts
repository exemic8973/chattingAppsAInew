import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { userStore } from '@/lib/userStore';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

console.log('🔐 Login API JWT_SECRET configured:', JWT_SECRET ? 'Yes (length: ' + JWT_SECRET.length + ')' : 'No');

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate credentials using userStore
    const isValid = await userStore.validatePassword(email, password);
    if (!isValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = await userStore.findByEmail(email);
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, userName: user.userName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}