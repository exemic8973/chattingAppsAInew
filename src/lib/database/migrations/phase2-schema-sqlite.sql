-- Phase 2 Database Schema Extensions (SQLite Compatible)
-- Adding support for host controls, waiting room, raise hand, reactions, and screen sharing
-- Modified to work with existing database structure

-- 1. Room Participants Table (extends room functionality)
CREATE TABLE IF NOT EXISTS room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_video_off BOOLEAN DEFAULT FALSE,
  is_screen_sharing BOOLEAN DEFAULT FALSE,
  is_hand_raised BOOLEAN DEFAULT FALSE,
  join_status TEXT DEFAULT 'approved' CHECK (join_status IN ('waiting', 'approved', 'rejected', 'removed')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_status ON room_participants(join_status);

-- 2. Host Actions Log (for audit trail)
CREATE TABLE IF NOT EXISTS host_actions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('mute', 'unmute', 'remove', 'approve_join', 'reject_join', 'make_host', 'remove_host')),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_host_actions_room_id ON host_actions(room_id);
CREATE INDEX IF NOT EXISTS idx_host_actions_created_at ON host_actions(created_at);

-- 3. Meeting Reactions Table
CREATE TABLE IF NOT EXISTS meeting_reactions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('👍', '❤️', '😂', '😮', '🎉', '👏')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_reactions_room_id ON meeting_reactions(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_reactions_created_at ON meeting_reactions(created_at);

-- 4. Screen Sharing Sessions
CREATE TABLE IF NOT EXISTS screen_sharing_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  session_type TEXT DEFAULT 'screen' CHECK (session_type IN ('screen', 'window', 'tab')),
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_screen_sharing_room_id ON screen_sharing_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_screen_sharing_active ON screen_sharing_sessions(is_active);

-- 5. Speaking Activity Log (for analytics and indicators)
CREATE TABLE IF NOT EXISTS speaking_activity (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  audio_level REAL,
  is_speaking BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_speaking_activity_room_id ON speaking_activity(room_id);
CREATE INDEX IF NOT EXISTS idx_speaking_activity_user_id ON speaking_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_speaking_activity_timestamp ON speaking_activity(timestamp);

-- 6. WebRTC Signaling Messages (for better debugging and reconnection)
CREATE TABLE IF NOT EXISTS webrtc_signaling (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webrtc_signaling_room_id ON webrtc_signaling(room_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signaling_timestamp ON webrtc_signaling(timestamp);