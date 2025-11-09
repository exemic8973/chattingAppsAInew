// Shared user storage for Next.js API routes
import bcrypt from 'bcryptjs';

interface User {
  id: string;
  email: string;
  password: string;
  userName: string;
  createdAt: string;
}

class UserStore {
  private users: Map<string, User> = new Map();

  constructor() {
    // Initialize with a test user for development
    if (this.users.size === 0) {
      const testUser: User = {
        id: 'test-user-1',
        email: 'test@example.com',
        password: '$2a$10$rOvFTJg6/8SH5K4K5J5J5O5K5J5J5O5K5J5J5O5K5J5J5O5K5J5J5O', // "test123"
        userName: 'Test User',
        createdAt: new Date().toISOString()
      };
      this.users.set('test@example.com', testUser);
    }
  }

  async createUser(email: string, password: string, userName: string): Promise<User> {
    const existingUser = this.users.get(email.toLowerCase());
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      password: hashedPassword,
      userName: userName.trim(),
      createdAt: new Date().toISOString()
    };

    this.users.set(email.toLowerCase(), user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.get(email.toLowerCase()) || null;
  }

  async validatePassword(email: string, password: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  clear(): void {
    this.users.clear();
  }
}

export const userStore = new UserStore();