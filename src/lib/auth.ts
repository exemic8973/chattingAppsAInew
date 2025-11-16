import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { userStore } from '@/lib/userStore';
import { config } from '@/lib/config';

/**
 * Verify JWT token using secure configuration
 */
export async function verifyToken(token: string, secret?: string): Promise<any> {
  try {
    const jwtSecret = secret || config.jwt.getSecret();
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    console.error('Token verification failed:', error);
    throw error;
  }
}

/**
 * Generate JWT token using secure configuration
 */
export function generateToken(payload: any, expiresIn?: string): string {
  try {
    const secret = config.jwt.getSecret();
    const expiration = expiresIn || config.jwt.expiresIn;
    return jwt.sign(payload, secret, { expiresIn: expiration } as jwt.SignOptions);
  } catch (error) {
    console.error('Token generation failed:', error);
    throw error;
  }
}

/**
 * Legacy authentication function (deprecated - use middleware instead)
 * @deprecated Use withAuth middleware from @/lib/middleware/auth
 */
export async function authenticateToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return { success: false, message: 'No token provided' };
    }

    // Verify token using secure configuration
    const decoded = await verifyToken(token);
    
    // Check if user exists
    const user = await userStore.findByEmail(decoded.email);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, user };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: 'Invalid token' };
  }
}