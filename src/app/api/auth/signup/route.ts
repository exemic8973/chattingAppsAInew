import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { userStore } from '@/lib/userStore';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { email, password, userName } = await request.json();

    console.log('📝 Signup request received for:', email);

    if (!email || !password || !userName) {
      return NextResponse.json(
        { message: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Create user using userStore
    try {
      const user = await userStore.createUser(email, password, userName);
      console.log('✅ User created successfully:', user.email);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, userName: user.userName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return NextResponse.json({
        message: 'User created successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          userName: user.userName
        }
      });
    } catch (userError) {
      const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
      console.error('❌ User creation error:', errorMessage);

      // Check if it's a "User already exists" error
      if (errorMessage.includes('already exists')) {
        return NextResponse.json(
          { message: 'User with this email already exists' },
          { status: 409 }
        );
      }

      // Re-throw to outer catch
      throw userError;
    }

  } catch (error) {
    console.error('💥 Signup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Internal server error', error: errorMessage },
      { status: 500 }
    );
  }
}