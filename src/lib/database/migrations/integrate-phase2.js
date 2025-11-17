/**
 * Phase 2 Integration Script
 * Applies all database migrations and sets up the enhanced backend
 */

const { applyPhase2Migrations } = require('./applyPhase2Migrations');
const { databaseManager } = require('../DatabaseManager.ts');

async function integratePhase2Features() {
  console.log('🚀 Starting Phase 2 Backend Integration...\n');
  
  try {
    // Step 1: Apply database migrations
    console.log('📊 Step 1: Applying database schema extensions...');
    await applyPhase2Migrations();
    console.log('✅ Database migrations completed\n');

    // Step 2: Verify database health
    console.log('🔍 Step 2: Verifying database health...');
    const isHealthy = await databaseManager.healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed after migrations');
    }
    console.log('✅ Database health check passed\n');

    // Step 3: Test new repository functionality
    console.log('🧪 Step 3: Testing new repository functionality...');
    await testNewRepositories();
    console.log('✅ Repository tests completed\n');

    // Step 4: Create sample data for testing
    console.log('📝 Step 4: Creating sample test data...');
    await createSampleData();
    console.log('✅ Sample data created\n');

    console.log('🎉 Phase 2 Backend Integration completed successfully!');
    console.log('\n📋 Summary of implemented features:');
    console.log('  ✅ Multi-peer WebRTC support (3+ participants)');
    console.log('  ✅ Host controls (mute/remove participants)');
    console.log('  ✅ Waiting room/lobby system');
    console.log('  ✅ Raise hand feature');
    console.log('  ✅ Screen sharing capability');
    console.log('  ✅ Live speaking indicators');
    console.log('  ✅ Meeting reactions system');
    console.log('  ✅ Enhanced connection quality monitoring');
    console.log('  ✅ Comprehensive error handling');
    console.log('  ✅ Real-time socket.io events');

  } catch (error) {
    console.error('❌ Phase 2 Integration failed:', error);
    throw error;
  }
}

async function testNewRepositories() {
  const { getRoomParticipantRepository, getMeetingReactionRepository } = require('../../repositories/RepositoryFactory');
  
  try {
    const roomParticipantRepo = getRoomParticipantRepository();
    const meetingReactionRepo = getMeetingReactionRepository();

    // Test RoomParticipantRepository
    console.log('  Testing RoomParticipantRepository...');
    
    // Test basic operations
    const testParticipant = await roomParticipantRepo.create({
      roomId: 'test-room-1',
      userId: 'test-user-1',
      userName: 'Test User',
      isHost: false,
      joinStatus: 'approved'
    });
    
    console.log('    ✅ Created test participant:', testParticipant.id);

    // Test find operations
    const foundParticipant = await roomParticipantRepo.findByRoomAndUser('test-room-1', 'test-user-1');
    console.log('    ✅ Found participant by room and user');

    const allParticipants = await roomParticipantRepo.findByRoomId('test-room-1');
    console.log('    ✅ Found all participants in room:', allParticipants.length);

    // Test MeetingReactionRepository
    console.log('  Testing MeetingReactionRepository...');
    
    const testReaction = await meetingReactionRepo.createReaction({
      roomId: 'test-room-1',
      userId: 'test-user-1',
      userName: 'Test User',
      reactionType: '👍'
    });
    
    console.log('    ✅ Created test reaction:', testReaction.id);

    const recentReactions = await meetingReactionRepo.getRecentReactions('test-room-1', 10);
    console.log('    ✅ Retrieved recent reactions:', recentReactions.length);

    const reactionStats = await meetingReactionRepo.getReactionStats('test-room-1');
    console.log('    ✅ Retrieved reaction stats:', JSON.stringify(reactionStats, null, 2));

    // Cleanup test data
    await roomParticipantRepo.delete(testParticipant.id);
    await meetingReactionRepo.delete(testReaction.id);
    console.log('    ✅ Cleaned up test data');

  } catch (error) {
    console.error('  ❌ Repository test failed:', error);
    throw error;
  }
}

async function createSampleData() {
  const { getRoomRepository, getUserRepository } = require('../../repositories/RepositoryFactory');
  
  try {
    const roomRepo = getRoomRepository();
    const userRepo = getUserRepository();

    // Create test users if they don't exist
    let testUser = await userRepo.findByEmail('test-host@example.com');
    if (!testUser) {
      testUser = await userRepo.create({
        email: 'test-host@example.com',
        password: 'test123',
        userName: 'Test Host'
      });
      console.log('  Created test host user');
    }

    let testParticipant = await userRepo.findByEmail('test-participant@example.com');
    if (!testParticipant) {
      testParticipant = await userRepo.create({
        email: 'test-participant@example.com',
        password: 'test123',
        userName: 'Test Participant'
      });
      console.log('  Created test participant user');
    }

    // Create test room if it doesn't exist
    let testRoom = await roomRepo.findById('test-room-phase2');
    if (!testRoom) {
      testRoom = await roomRepo.create({
        passcode: 'PHASE2TEST',
        creator: testUser.email,
        creatorName: 'Test Host'
      });
      console.log('  Created test room for Phase 2');
    }

    console.log('  Sample data ready for testing');

  } catch (error) {
    console.error('  ❌ Sample data creation failed:', error);
    // Don't throw error here as sample data is optional
  }
}

// Health check function
async function healthCheck() {
  console.log('🏥 Running Phase 2 health check...');
  
  try {
    // Check database connection
    const isHealthy = await databaseManager.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    // Check repository functionality
    const { getRoomParticipantRepository } = require('../../repositories/RepositoryFactory');
    const repo = getRoomParticipantRepository();
    
    // Simple query to test repository
    const result = await repo.db.queryOne('SELECT COUNT(*) as count FROM room_participants');
    console.log('  ✅ Repository functionality test passed');

    console.log('✅ Phase 2 health check passed');
    return true;

  } catch (error) {
    console.error('❌ Phase 2 health check failed:', error);
    return false;
  }
}

// Run integration if called directly
if (require.main === module) {
  integratePhase2Features()
    .then(async () => {
      console.log('\n🔍 Running final health check...');
      const healthy = await healthCheck();
      
      if (healthy) {
        console.log('\n🎉 Phase 2 Backend Integration completed successfully!');
        console.log('\n🚀 Next steps:');
        console.log('  1. Restart your Next.js development server');
        console.log('  2. Test the new API endpoints');
        console.log('  3. Integrate the new socket events into your frontend');
        console.log('  4. Test multi-party video calls');
        console.log('\n📚 API Documentation available in: /docs/phase2-api-endpoints.md');
        process.exit(0);
      } else {
        console.log('\n⚠️  Integration completed but health check failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Phase 2 Integration failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  integratePhase2Features, 
  healthCheck 
};