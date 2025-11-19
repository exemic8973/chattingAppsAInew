const { z } = require('zod');

const ValidationSchemas = {
  auth: {
    signup: z.object({
      email: z.string()
        .email('Invalid email format')
        .min(3, 'Email must be at least 3 characters')
        .max(255, 'Email must not exceed 255 characters')
        .transform(email => email.toLowerCase().trim()),
      
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
      
      userName: z.string()
        .min(2, 'Username must be at least 2 characters')
        .max(50, 'Username must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_\s-]+$/, 'Username can only contain letters, numbers, spaces, underscores, and hyphens')
        .transform(name => name.trim())
    }),

    login: z.object({
      email: z.string()
        .email('Invalid email format')
        .transform(email => email.toLowerCase().trim()),
      
      password: z.string()
        .min(1, 'Password is required')
        .max(128, 'Password must not exceed 128 characters')
    }),

    refresh: z.object({
      refreshToken: z.string()
        .min(1, 'Refresh token is required')
    })
  },

  room: {
    create: z.object({
      roomId: z.string()
        .min(3, 'Room ID must be at least 3 characters')
        .max(50, 'Room ID must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID can only contain letters, numbers, underscores, and hyphens')
        .optional(),
      
      passcode: z.string()
        .min(4, 'Passcode must be at least 4 characters')
        .max(50, 'Passcode must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9]+$/, 'Passcode can only contain letters and numbers'),
      
      userName: z.string()
        .min(2, 'Username must be at least 2 characters')
        .max(50, 'Username must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_\s-]+$/, 'Username can only contain letters, numbers, spaces, underscores, and hyphens')
        .transform(name => name.trim())
    }),

    join: z.object({
      roomId: z.string()
        .min(3, 'Room ID is required')
        .max(50, 'Room ID must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID can only contain letters, numbers, underscores, and hyphens'),
      
      passcode: z.string()
        .min(4, 'Passcode is required')
        .max(50, 'Passcode must not exceed 50 characters'),
      
      userName: z.string()
        .min(2, 'Username must be at least 2 characters')
        .max(50, 'Username must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_\s-]+$/, 'Username can only contain letters, numbers, spaces, underscores, and hyphens')
        .transform(name => name.trim()),
      
      persistentUserId: z.string()
        .optional()
        .transform(id => id || undefined)
    }),

    updateSocket: z.object({
      roomId: z.string()
        .min(3, 'Room ID is required')
        .max(50, 'Room ID must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID can only contain letters, numbers, underscores, and hyphens'),
      
      passcode: z.string()
        .min(4, 'Passcode is required')
        .max(50, 'Passcode must not exceed 50 characters')
        .optional()
    })
  },

  message: {
    send: z.object({
      roomId: z.string()
        .min(3, 'Room ID is required')
        .max(50, 'Room ID must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID can only contain letters, numbers, underscores, and hyphens'),
      
      message: z.string()
        .min(1, 'Message cannot be empty')
        .max(5000, 'Message must not exceed 5000 characters')
        .transform(msg => msg.trim()),
      
      messageId: z.string()
        .uuid('Invalid message ID format')
        .optional(),
      
      type: z.enum(['text', 'system', 'file', 'reaction'])
        .default('text')
    }),

    reaction: z.object({
      roomId: z.string()
        .min(3, 'Room ID is required')
        .max(50, 'Room ID must not exceed 50 characters'),
      
      messageId: z.string()
        .uuid('Invalid message ID format'),
      
      emoji: z.string()
        .min(1, 'Emoji is required')
        .max(10, 'Emoji must not exceed 10 characters')
    })
  },

  webrtc: {
    signal: z.object({
      roomId: z.string()
        .min(3, 'Room ID is required')
        .max(50, 'Room ID must not exceed 50 characters'),
      
      signalData: z.any(),
      
      targetUserId: z.string()
        .min(1, 'Target user ID is required')
        .max(100, 'Target user ID must not exceed 100 characters')
        .optional()
    }),

    call: z.object({
      roomId: z.string()
        .min(3, 'Room ID is required')
        .max(50, 'Room ID must not exceed 50 characters'),
      
      callType: z.enum(['audio', 'video']),
      
      targetUserId: z.string()
        .min(1, 'Target user ID is required')
        .max(100, 'Target user ID must not exceed 100 characters')
        .optional()
    })
  },

  socket: {
    authenticate: z.object({
      token: z.string()
        .min(1, 'Authentication token is required')
    })
  }
};

module.exports = ValidationSchemas;