import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/response';
import { databaseManager } from '@/lib/database/DatabaseManager';
import { getUserRepository, getRoomRepository } from '@/lib/repositories/RepositoryFactory';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Health check endpoint
 * Checks API status, database connectivity, and repository health
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  
  try {
    // Check database health
    const databaseHealthy = await databaseManager.healthCheck();
    
    // Check repository health with lightweight queries
    let repositoriesHealthy = false;
    let totalUsers = 0;
    let totalRooms = 0;
    
    try {
      const userRepo = getUserRepository();
      const roomRepo = getRoomRepository();
      
      // Quick health checks
      totalUsers = await userRepo.count();
      totalRooms = await roomRepo.count();
      repositoriesHealthy = true;
    } catch (error) {
      console.warn('Repository health check failed:', error);
    }

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: databaseHealthy ? 'connected' : 'disconnected',
        repositories: repositoriesHealthy ? 'healthy' : 'unhealthy',
        socket: 'check server.js separately'
      },
      metrics: {
        totalUsers,
        totalRooms,
        uptime: process.uptime()
      },
      version: {
        node: process.version,
        api: 'v1.0'
      },
      endpoints: [
        '/api/auth/signup',
        '/api/auth/login', 
        '/api/auth/me',
        '/api/rooms/create',
        '/api/health'
      ]
    };

    // Determine overall health status
    const isHealthy = databaseHealthy && repositoriesHealthy;
    
    if (isHealthy) {
      return ApiResponse.success(healthStatus, 'System is healthy', correlationId);
    } else {
      return ApiResponse.serviceUnavailable(
        'System is experiencing issues',
        'SYSTEM_UNHEALTHY',
        healthStatus,
        correlationId
      );
    }

  } catch (error) {
    console.error('Health check error:', error);
    return ApiResponse.internalError(
      'Health check failed',
      'HEALTH_CHECK_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}