# Phase 2 API Endpoints Documentation

This document describes all the new API endpoints implemented for Phase 2 features of the chat application.

## 🎯 Overview

Phase 2 introduces critical meeting features including:
- Multi-peer WebRTC support (3+ participants)
- Host controls (mute/remove participants)
- Waiting room/lobby system
- Raise hand feature
- Screen sharing capability
- Live speaking indicators
- Meeting reactions system

## 🔐 Authentication

All Phase 2 endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## 📋 API Endpoints

### Host Controls

#### Mute/Unmute Participant
```http
POST /api/rooms/{roomId}/participants/{userId}/mute
DELETE /api/rooms/{roomId}/participants/{userId}/mute
```

**Request Body (optional):**
```json
{
  "reason": "Participant was being disruptive"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "user-123",
    "userName": "John Doe",
    "isMuted": true,
    "mutedBy": "Host Name",
    "reason": "Participant was being disruptive"
  },
  "message": "Participant muted successfully"
}
```

#### Remove Participant
```http
DELETE /api/rooms/{roomId}/participants/{userId}
```

**Request Body (optional):**
```json
{
  "reason": "Violation of meeting rules"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "user-123",
    "userName": "John Doe",
    "removedBy": "Host Name",
    "reason": "Violation of meeting rules",
    "removedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Participant removed successfully"
}
```

#### Get Participant Info
```http
GET /api/rooms/{roomId}/participants/{userId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "participant-123",
    "userId": "user-123",
    "userName": "John Doe",
    "isHost": false,
    "isMuted": true,
    "isVideoOff": false,
    "isScreenSharing": false,
    "isHandRaised": false,
    "joinStatus": "approved",
    "joinedAt": "2024-01-15T10:00:00Z",
    "leftAt": null
  }
}
```

### Waiting Room/Lobby System

#### Get Waiting List (Host Only)
```http
GET /api/rooms/{roomId}/waiting-list
```

**Response:**
```json
{
  "success": true,
  "data": {
    "waitingList": [
      {
        "id": "participant-456",
        "userId": "user-456",
        "userName": "Jane Smith",
        "joinedAt": "2024-01-15T10:25:00Z"
      }
    ],
    "count": 1
  }
}
```

#### Request to Join Room
```http
POST /api/rooms/{roomId}/waiting-list
```

**Request Body:**
```json
{
  "userName": "Jane Smith",
  "userId": "user-456" // Optional, for authenticated users
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-456",
    "userId": "user-456",
    "userName": "Jane Smith",
    "status": "waiting",
    "message": "Join request submitted. Please wait for host approval.",
    "joinedAt": "2024-01-15T10:25:00Z"
  }
}
```

#### Approve Join Request (Host Only)
```http
PUT /api/rooms/{roomId}/waiting-list
```

**Request Body:**
```json
{
  "participantId": "participant-456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-456",
    "userId": "user-456",
    "userName": "Jane Smith",
    "status": "approved",
    "approvedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Join request approved successfully"
}
```

#### Reject Join Request (Host Only)
```http
DELETE /api/rooms/{roomId}/waiting-list
```

**Request Body:**
```json
{
  "participantId": "participant-456",
  "reason": "Room is at capacity"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-456",
    "userId": "user-456",
    "userName": "Jane Smith",
    "status": "rejected",
    "reason": "Room is at capacity",
    "rejectedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Join request rejected successfully"
}
```

### Raise Hand Feature

#### Raise Hand
```http
POST /api/rooms/{roomId}/raise-hand
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-123",
    "userId": "user-123",
    "userName": "John Doe",
    "isHandRaised": true,
    "raisedAt": "2024-01-15T10:35:00Z"
  },
  "message": "Hand raised successfully"
}
```

#### Lower Hand
```http
DELETE /api/rooms/{roomId}/raise-hand
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-123",
    "userId": "user-123",
    "userName": "John Doe",
    "isHandRaised": false,
    "loweredAt": "2024-01-15T10:36:00Z"
  },
  "message": "Hand lowered successfully"
}
```

#### Get Raised Hands
```http
GET /api/rooms/{roomId}/raise-hand
```

**Response:**
```json
{
  "success": true,
  "data": {
    "raisedHands": [
      {
        "participantId": "participant-123",
        "userId": "user-123",
        "userName": "John Doe",
        "isHost": false,
        "raisedAt": "2024-01-15T10:35:00Z"
      }
    ],
    "count": 1
  }
}
```

#### Lower Other's Hand (Host Only)
```http
PATCH /api/rooms/{roomId}/raise-hand
```

**Request Body:**
```json
{
  "participantId": "participant-123"
}
```

### Screen Sharing

#### Start Screen Sharing
```http
POST /api/rooms/{roomId}/screen-share
```

**Request Body:**
```json
{
  "sessionType": "screen" // "screen", "window", or "tab"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-123",
    "userId": "user-123",
    "userName": "John Doe",
    "sessionType": "screen",
    "isActive": true,
    "startedAt": "2024-01-15T10:40:00Z",
    "message": "Screen sharing session started successfully"
  }
}
```

#### Stop Screen Sharing
```http
DELETE /api/rooms/{roomId}/screen-share
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-123",
    "userId": "user-123",
    "userName": "John Doe",
    "isActive": false,
    "endedAt": "2024-01-15T10:45:00Z",
    "message": "Screen sharing session stopped successfully"
  }
}
```

#### Get Active Screen Shares
```http
GET /api/rooms/{roomId}/screen-share
```

**Response:**
```json
{
  "success": true,
  "data": {
    "screenShares": [
      {
        "participantId": "participant-123",
        "userId": "user-123",
        "userName": "John Doe",
        "isHost": false,
        "startedAt": "2024-01-15T10:40:00Z"
      }
    ],
    "count": 1
  }
}
```

#### Force Stop Screen Share (Host Only)
```http
PATCH /api/rooms/{roomId}/screen-share
```

**Request Body:**
```json
{
  "participantId": "participant-123"
}
```

### Meeting Reactions

#### Send Reaction
```http
POST /api/rooms/{roomId}/reactions
```

**Request Body:**
```json
{
  "reaction": "👍"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reactionId": "reaction-123",
    "userId": "user-123",
    "userName": "John Doe",
    "reaction": "👍",
    "createdAt": "2024-01-15T10:50:00Z"
  }
}
```

#### Get Recent Reactions
```http
GET /api/rooms/{roomId}/reactions?limit=50&stats=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reactions": [
      {
        "id": "reaction-123",
        "userId": "user-123",
        "userName": "John Doe",
        "reaction": "👍",
        "createdAt": "2024-01-15T10:50:00Z"
      }
    ],
    "count": 1,
    "stats": {
      "totalReactions": 1,
      "reactionsByType": {
        "👍": 1
      },
      "topReactors": [
        {
          "userId": "user-123",
          "userName": "John Doe",
          "reactionCount": 1
        }
      ]
    }
  }
}
```

#### Get Reaction Statistics
```http
GET /api/rooms/{roomId}/reactions?endpoint=stats
```

#### Get Reaction Timeline
```http
GET /api/rooms/{roomId}/reactions?endpoint=timeline&timeWindow=60
```

### Speaking Indicators

#### Update Speaking Status
```http
POST /api/rooms/{roomId}/speaking
```

**Request Body:**
```json
{
  "audioLevel": 0.7,
  "isSpeaking": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant-123",
    "userId": "user-123",
    "userName": "John Doe",
    "audioLevel": 0.7,
    "isSpeaking": true,
    "updatedAt": "2024-01-15T10:55:00Z"
  }
}
```

#### Get Speaking Participants
```http
GET /api/rooms/{roomId}/speaking
```

**Response:**
```json
{
  "success": true,
  "data": {
    "speakingParticipants": [
      {
        "participantId": "participant-123",
        "userId": "user-123",
        "userName": "John Doe",
        "isHost": false,
        "isMuted": false,
        "isSpeaking": true,
        "audioLevel": 0.7,
        "lastSpeakingUpdate": "2024-01-15T10:55:00Z"
      }
    ],
    "count": 1,
    "lastUpdate": "2024-01-15T10:55:00Z"
  }
}
```

#### Get Speaking Activity History (Host Only)
```http
GET /api/rooms/{roomId}/speaking?type=activity&timeWindow=300
```

#### Get Speaking Analytics (Host Only)
```http
GET /api/rooms/{roomId}/speaking?type=analytics&startTime=2024-01-15T10:00:00Z&endTime=2024-01-15T11:00:00Z
```

## 🔄 Real-time Socket.io Events

### Host Control Events
- `participant-muted-by-host` - Received when host mutes you
- `participant-removed-by-host` - Received when host removes you
- `participant-mute-status` - Broadcast when someone's mute status changes

### Raise Hand Events
- `hand-raised` - Broadcast when someone raises their hand
- `hand-lowered` - Broadcast when someone lowers their hand
- `hand-lowered-by-host` - Received when host lowers your hand

### Screen Sharing Events
- `screen-share-started` - Broadcast when someone starts screen sharing
- `screen-share-stopped` - Broadcast when someone stops screen sharing

### Reaction Events
- `new-reaction` - Broadcast when someone sends a reaction

### Speaking Indicator Events
- `participant-speaking-status` - Real-time speaking status updates
- `participant-poor-connection` - Host notification about poor connections

### Waiting Room Events
- `waiting-for-approval` - Received when you're added to waiting list
- `join-request-approved` - Received when host approves your join request
- `join-request-rejected` - Received when host rejects your join request
- `new-waiting-participant` - Host notification about new waiting participant
- `waiting-list-updated` - Host notification about waiting list changes

### Enhanced WebRTC Events
- `webrtc-signal` - Enhanced signaling with user information
- `connection-quality-report` - Connection quality updates

## 🚨 Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "message": "Detailed error message",
    "code": "ERROR_CODE",
    "details": {},
    "correlationId": "corr-123"
  }
}
```

### Common Error Codes
- `NOT_AUTHENTICATED` - Missing or invalid authentication
- `NOT_HOST` - User is not the room host
- `ROOM_NOT_FOUND` - Room doesn't exist
- `PARTICIPANT_NOT_FOUND` - Participant not found in room
- `INVALID_REACTION_TYPE` - Invalid reaction emoji
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SCREEN_SHARE_IN_USE` - Someone else is already screen sharing

## 🎯 Integration Guide

### 1. Database Migration
```bash
# Run the Phase 2 migration script
node src/lib/database/migrations/integrate-phase2.js
```

### 2. Socket.io Integration
Add the Phase 2 socket events to your server.js:
```javascript
const { setupPhase2SocketEvents } = require('./server-phase2-enhancements');

// In your socket connection handler
io.on('connection', (socket) => {
  setupPhase2SocketEvents(io, socket, rooms, connectedUsers);
  // ... existing socket handlers
});
```

### 3. Frontend Integration
Replace the existing WebRTC manager with the enhanced version:
```javascript
import { EnhancedMultiPeerManager } from '@/lib/webrtc-enhanced';

const peerManager = new EnhancedMultiPeerManager();
```

### 4. API Client Setup
Create a centralized API client for Phase 2 endpoints:
```javascript
// lib/api/phase2-client.js
export const phase2Api = {
  muteParticipant: (roomId, userId, reason) => 
    fetch(`/api/rooms/${roomId}/participants/${userId}/mute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ reason })
    }),
  
  // ... other API methods
};
```

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Configure TURN servers for better connectivity
NEXT_PUBLIC_TURN_SERVER=turn:your-turn-server.com:3478
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_CREDENTIAL=password
```

### Rate Limiting
- Reactions: 10 per minute per user
- API requests: Configurable per endpoint

### Connection Limits
- Maximum 20 participants per room
- Automatic reconnection on connection failure
- Quality-based connection optimization

## 🔍 Testing

### Test Script
```bash
# Run the integration tests
node src/lib/database/migrations/integrate-phase2.js

# Test specific features
npm run test:phase2
```

### Test Users
- Host: `test-host@example.com` / `test123`
- Participant: `test-participant@example.com` / `test123`

## 📊 Monitoring

### Health Check Endpoint
```http
GET /health
```

### Connection Metrics
The enhanced WebRTC manager provides:
- Connection quality metrics
- Packet loss tracking
- Latency monitoring
- Bitrate optimization

## 🚀 Performance Optimizations

### Database
- Indexed queries for participant lookups
- Connection pooling for high concurrency
- Efficient reaction storage with cleanup

### WebRTC
- Simulcast for better bandwidth utilization
- Adaptive bitrate based on connection quality
- Automatic fallback to audio-only on poor connections

### Real-time
- Efficient socket.io event broadcasting
- Connection state caching
- Optimized reaction delivery

## 🔒 Security Considerations

### Authorization
- Host-only endpoints are strictly enforced
- Participant status validation
- Room membership verification

### Data Protection
- No sensitive data in reactions
- Speaking activity anonymization options
- Secure WebRTC signaling

### Rate Limiting
- Prevents abuse of reaction system
- Limits on join requests
- API endpoint throttling

## 📞 Support

For issues or questions:
1. Check the health endpoint: `/health`
2. Review server logs for detailed error messages
3. Verify database migrations are applied
4. Test with the provided sample users

---

**Note**: This documentation covers the backend API implementation. Frontend integration guides are available separately.