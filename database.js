const isProduction = process.env.NODE_ENV === 'production';

// Use PostgreSQL for production, SQLite for development
let db, pool;

if (isProduction) {
  // ============================================
  // PRODUCTION: PostgreSQL
  // ============================================
  const { Pool } = require('pg');

  const dbHost = process.env.PGHOST || process.env.DB_HOST || 'localhost';
  const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1' ||
                      process.env.DATABASE_URL?.includes('localhost') ||
                      process.env.DATABASE_URL?.includes('127.0.0.1');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: dbHost,
    port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'chatapp',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: !isLocalhost ? { rejectUnauthorized: false } : false
  });

  console.log('💾 PostgreSQL connection configured (Production):', {
    host: pool.options.host || 'from DATABASE_URL',
    database: pool.options.database || 'from DATABASE_URL',
    ssl: !!pool.options.ssl
  });

  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Error connecting to PostgreSQL:', err.message);
      console.error('💡 Make sure PostgreSQL is running and DATABASE_URL is set correctly');
    } else {
      console.log('✅ PostgreSQL connected successfully');
      release();
    }
  });
} else {
  // ============================================
  // DEVELOPMENT: SQLite
  // ============================================
  const Database = require('better-sqlite3');
  db = new Database('chat.db');
  console.log('💾 SQLite database configured (Development): chat.db');
}

// ============================================
// Initialize database schema
// ============================================
async function initializeDatabase() {
  if (isProduction) {
    // PostgreSQL initialization
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          user_name TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
      `);

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
  } else {
    // SQLite initialization
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        user_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        passcode TEXT NOT NULL,
        creator TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `);

    console.log('✅ SQLite schema initialized');
  }
}

// ============================================
// User operations
// ============================================
const userOps = {
  create: async (user) => {
    if (isProduction) {
      const query = `
        INSERT INTO users (id, email, password, user_name, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const values = [user.id, user.email, user.password, user.userName, user.createdAt];
      const result = await pool.query(query, values);
      return result.rows[0];
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (id, email, password, user_name, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(user.id, user.email, user.password, user.userName, user.createdAt);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }
  },

  findByEmail: async (email) => {
    if (isProduction) {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await pool.query(query, [email]);
      return result.rows[0];
    } else {
      return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
  },

  findById: async (id) => {
    if (isProduction) {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } else {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
  },

  getAll: async () => {
    if (isProduction) {
      const query = 'SELECT * FROM users ORDER BY created_at DESC';
      const result = await pool.query(query);
      return result.rows;
    } else {
      return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    }
  }
};

// ============================================
// Room operations
// ============================================
const roomOps = {
  create: async (room) => {
    if (isProduction) {
      const query = `
        INSERT INTO rooms (id, passcode, creator, creator_name, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const values = [room.id, room.passcode, room.creator, room.creatorName, room.createdAt];
      const result = await pool.query(query, values);
      return result.rows[0];
    } else {
      const stmt = db.prepare(`
        INSERT INTO rooms (id, passcode, creator, creator_name, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(room.id, room.passcode, room.creator, room.creatorName, room.createdAt);
      return db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
    }
  },

  findById: async (id) => {
    if (isProduction) {
      const query = 'SELECT * FROM rooms WHERE id = $1';
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } else {
      return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    }
  },

  getAll: async () => {
    if (isProduction) {
      const query = 'SELECT * FROM rooms ORDER BY created_at DESC';
      const result = await pool.query(query);
      return result.rows;
    } else {
      return db.prepare('SELECT * FROM rooms ORDER BY created_at DESC').all();
    }
  },

  delete: async (id) => {
    if (isProduction) {
      const query = 'DELETE FROM rooms WHERE id = $1';
      const result = await pool.query(query, [id]);
      return result.rowCount;
    } else {
      const stmt = db.prepare('DELETE FROM rooms WHERE id = ?');
      const result = stmt.run(id);
      return result.changes;
    }
  }
};

// ============================================
// Message operations
// ============================================
const messageOps = {
  create: async (message) => {
    if (isProduction) {
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
    } else {
      const stmt = db.prepare(`
        INSERT INTO messages (id, room_id, user_name, user_id, content, type, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        message.id,
        message.roomId,
        message.userName,
        message.userId,
        message.content,
        message.type || 'text',
        message.timestamp
      );
      return db.prepare('SELECT * FROM messages WHERE id = ?').get(message.id);
    }
  },

  getByRoomId: async (roomId, limit = 100) => {
    if (isProduction) {
      const query = `
        SELECT * FROM messages
        WHERE room_id = $1
        ORDER BY timestamp ASC
        LIMIT $2
      `;
      const result = await pool.query(query, [roomId, limit]);
      return result.rows;
    } else {
      return db.prepare(`
        SELECT * FROM messages
        WHERE room_id = ?
        ORDER BY timestamp ASC
        LIMIT ?
      `).all(roomId, limit);
    }
  },

  deleteByRoomId: async (roomId) => {
    if (isProduction) {
      const query = 'DELETE FROM messages WHERE room_id = $1';
      const result = await pool.query(query, [roomId]);
      return result.rowCount;
    } else {
      const stmt = db.prepare('DELETE FROM messages WHERE room_id = ?');
      const result = stmt.run(roomId);
      return result.changes;
    }
  },

  getRecent: async (roomId, limit = 50) => {
    if (isProduction) {
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
    } else {
      return db.prepare(`
        SELECT * FROM (
          SELECT * FROM messages
          WHERE room_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        )
        ORDER BY timestamp ASC
      `).all(roomId, limit);
    }
  }
};

// Initialize database on module load
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  if (isProduction) {
    pool.end(() => {
      console.log('PostgreSQL pool has ended');
    });
  } else {
    db.close();
    console.log('SQLite database closed');
  }
});

module.exports = {
  pool,
  db,
  userOps,
  roomOps,
  messageOps,
  initializeDatabase
};
