/**
 * Repository factory for managing all data access repositories
 */

import { db } from '@/lib/database/DatabaseManager';
import { UserRepository } from './UserRepository';
import { RoomRepository } from './RoomRepository';
import { RoomParticipantRepository } from './RoomParticipantRepository';
import { MeetingReactionRepository } from './MeetingReactionRepository';

/**
 * Repository factory singleton
 */
class RepositoryFactory {
  private static instance: RepositoryFactory;
  private repositories: {
    userRepository?: UserRepository;
    roomRepository?: RoomRepository;
    roomParticipantRepository?: RoomParticipantRepository;
    meetingReactionRepository?: MeetingReactionRepository;
  } = {};

  private constructor() {}

  static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  /**
   * Get user repository
   */
  getUserRepository(): UserRepository {
    if (!this.repositories.userRepository) {
      this.repositories.userRepository = new UserRepository(db);
    }
    return this.repositories.userRepository;
  }

  /**
   * Get room repository
   */
  getRoomRepository(): RoomRepository {
    if (!this.repositories.roomRepository) {
      this.repositories.roomRepository = new RoomRepository(db);
    }
    return this.repositories.roomRepository;
  }

  /**
   * Reset repositories (for testing)
   */
  reset(): void {
    this.repositories = {};
  }

  /**
   * Get room participant repository
   */
  getRoomParticipantRepository(): RoomParticipantRepository {
    if (!this.repositories.roomParticipantRepository) {
      this.repositories.roomParticipantRepository = new RoomParticipantRepository(db);
    }
    return this.repositories.roomParticipantRepository;
  }

  /**
   * Get meeting reaction repository
   */
  getMeetingReactionRepository(): MeetingReactionRepository {
    if (!this.repositories.meetingReactionRepository) {
      this.repositories.meetingReactionRepository = new MeetingReactionRepository(db);
    }
    return this.repositories.meetingReactionRepository;
  }

  /**
   * Get all repositories
   */
  getAllRepositories() {
    return {
      userRepository: this.getUserRepository(),
      roomRepository: this.getRoomRepository(),
      roomParticipantRepository: this.getRoomParticipantRepository(),
      meetingReactionRepository: this.getMeetingReactionRepository()
    };
  }
}

// Export singleton instance
export const repositoryFactory = RepositoryFactory.getInstance();

// Export convenience functions
export const getUserRepository = () => repositoryFactory.getUserRepository();
export const getRoomRepository = () => repositoryFactory.getRoomRepository();
export const getRoomParticipantRepository = () => repositoryFactory.getRoomParticipantRepository();
export const getMeetingReactionRepository = () => repositoryFactory.getMeetingReactionRepository();

export default repositoryFactory;