const { Pool } = require('pg');

// PostgreSQL connection configuration
// Priority: DATABASE_URL > individual env vars > defaults
const dbHost = process.env.PGHOST || process.env.DB_HOST || 'localhost';
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1' ||
                    process.env.DATABASE_URL?.includes('localhost') ||
                    process.env.DATABASE_URL?.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual env vars if DATABASE_URL not set
  host: dbHost,
  port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
  database: process.env.PGDATABASE || process.env.DB_NAME || 'chatapp',
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // SSL configuration: only enable for production and non-localhost connections
  ssl: process.env.NODE_ENV === 'production' && !isLocalhost
    ? { rejectUnauthorized: false }
    : false
});

console.log('💾 PostgreSQL connection configured:', {
  host: pool.options.host || 'from DATABASE_URL',
  database: pool.options.database || 'from DATABASE_URL',
  ssl: !!pool.options.ssl
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.message);
    console.error('💡 Make sure PostgreSQL is running and DATABASE_URL is set correctly');
  } else {
    console.log('✅ PostgreSQL connected successfully');
    release();
  }
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        user_name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create index on email for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    // Rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        passcode TEXT NOT NULL,
        creator TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (creator) REFERENCES users(email) ON DELETE CASCADE
      )
    `);

    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `);

    await client.query('COMMIT');
    console.log('✅ PostgreSQL schema initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// User operations
const userOps = {
  create: async (user) => {
    const query = `
      INSERT INTO users (id, email, password, user_name, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [user.id, user.email, user.password, user.userName, user.createdAt];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  findByEmail: async (email) => {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  },

  findById: async (id) => {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  getAll: async () => {
    const query = 'SELECT * FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }
};

// Room operations
const roomOps = {
  create: async (room) => {
    const query = `
      INSERT INTO rooms (id, passcode, creator, creator_name, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [room.id, room.passcode, room.creator, room.creatorName, room.createdAt];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  findById: async (id) => {
    const query = 'SELECT * FROM rooms WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  getAll: async () => {
    const query = 'SELECT * FROM rooms ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  },

  delete: async (id) => {
    const query = 'DELETE FROM rooms WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount;
  }
};

// Message operations
const messageOps = {
  create: async (message) => {
    const query = `
      INSERT INTO messages (id, room_id, user_name, user_id, content, type, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      message.id,
      message.roomId,
      message.userName,
      message.userId,
      message.content,
      message.type || 'text',
      message.timestamp
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  getByRoomId: async (roomId, limit = 100) => {
    const query = `
      SELECT * FROM messages
      WHERE room_id = $1
      ORDER BY timestamp ASC
      LIMIT $2
    `;
    const result = await pool.query(query, [roomId, limit]);
    return result.rows;
  },

  deleteByRoomId: async (roomId) => {
    const query = 'DELETE FROM messages WHERE room_id = $1';
    const result = await pool.query(query, [roomId]);
    return result.rowCount;
  },

  // Get recent messages (last N messages)
  getRecent: async (roomId, limit = 50) => {
    const query = `
      SELECT * FROM (
        SELECT * FROM messages
        WHERE room_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      ) sub
      ORDER BY timestamp ASC
    `;
    const result = await pool.query(query, [roomId, limit]);
    return result.rows;
  }
};

// Initialize database on module load
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  pool.end(() => {
    console.log('PostgreSQL pool has ended');
  });
});

module.exports = {
  pool,
  userOps,
  roomOps,
  messageOps,
  initializeDatabase
};
