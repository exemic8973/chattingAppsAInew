/**
 * Phase 2 Socket.io Event Enhancements
 * Add these event handlers to the existing server.js file
 * 
 * Copy and integrate these enhancements into your existing server.js
 */

// Enhanced socket event handlers for Phase 2 features
function setupPhase2SocketEvents(io, socket, rooms, connectedUsers) {
  
  // ===== HOST CONTROLS EVENTS =====
  
  // Host mutes participant
  socket.on('host-mute-participant', (data) => {
    const { roomId, targetUserId, reason } = data;
    console.log(`🔇 Host mute request from ${socket.id} for user ${targetUserId} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Verify requester is the host
    const requester = room.participants.find(p => p.socketId === socket.id);
    if (!requester || !requester.isCreator) {
      socket.emit('error', { message: 'Only the host can mute participants' });
      return;
    }

    // Find the target participant
    const targetParticipant = room.participants.find(p => p.id === targetUserId);
    if (!targetParticipant) {
      socket.emit('error', { message: 'Target user not found' });
      return;
    }

    // Emit mute event to the target user
    io.to(targetParticipant.socketId).emit('participant-muted-by-host', {
      roomId,
      mutedBy: requester.name,
      reason,
      timestamp: Date.now()
    });

    // Broadcast mute status to all participants in the room
    io.to(roomId).emit('participant-mute-status', {
      userId: targetUserId,
      userName: targetParticipant.name,
      isMuted: true,
      mutedByHost: true,
      mutedBy: requester.name,
      timestamp: Date.now()
    });

    console.log(`✅ Participant ${targetParticipant.name} muted by host`);
  });

  // Host removes participant
  socket.on('host-remove-participant', (data) => {
    const { roomId, targetUserId, reason } = data;
    console.log(`🚫 Host remove request from ${socket.id} for user ${targetUserId} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Verify requester is the host
    const requester = room.participants.find(p => p.socketId === socket.id);
    if (!requester || !requester.isCreator) {
      socket.emit('error', { message: 'Only the host can remove participants' });
      return;
    }

    // Find the target participant
    const targetParticipant = room.participants.find(p => p.id === targetUserId);
    if (!targetParticipant) {
      socket.emit('error', { message: 'Target user not found' });
      return;
    }

    // Emit removal event to the target user
    io.to(targetParticipant.socketId).emit('participant-removed-by-host', {
      roomId,
      removedBy: requester.name,
      reason,
      timestamp: Date.now()
    });

    // Remove participant from room
    room.participants = room.participants.filter(p => p.id !== targetUserId);

    // Make the removed participant leave the room
    io.sockets.sockets.get(targetParticipant.socketId)?.leave(roomId);

    // Broadcast removal to remaining participants
    io.to(roomId).emit('participant-left', {
      userId: targetUserId,
      userName: targetParticipant.name,
      removedByHost: true,
      removedBy: requester.name,
      participantCount: room.participants.length,
      timestamp: Date.now()
    });

    console.log(`✅ Participant ${targetParticipant.name} removed by host`);
  });

  // ===== RAISE HAND EVENTS =====

  // Participant raises hand
  socket.on('raise-hand', (data) => {
    const { roomId, userName } = data;
    console.log(`✋ Raise hand from ${socket.id} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    // Update participant's hand status
    participant.isHandRaised = true;
    participant.handRaisedAt = Date.now();

    // Notify all participants about raised hand
    io.to(roomId).emit('hand-raised', {
      userId: participant.id,
      userName: participant.name,
      raisedAt: participant.handRaisedAt,
      timestamp: Date.now()
    });

    // Notify host specifically
    const host = room.participants.find(p => p.isCreator);
    if (host && host.socketId !== socket.id) {
      io.to(host.socketId).emit('participant-hand-raised', {
        userId: participant.id,
        userName: participant.name,
        raisedAt: participant.handRaisedAt
      });
    }

    console.log(`✅ ${participant.name} raised hand in room ${roomId}`);
  });

  // Participant lowers hand
  socket.on('lower-hand', (data) => {
    const { roomId } = data;
    console.log(`👇 Lower hand from ${socket.id} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    // Update participant's hand status
    participant.isHandRaised = false;

    // Notify all participants about lowered hand
    io.to(roomId).emit('hand-lowered', {
      userId: participant.id,
      userName: participant.name,
      timestamp: Date.now()
    });

    console.log(`✅ ${participant.name} lowered hand in room ${roomId}`);
  });

  // Host lowers participant's hand
  socket.on('host-lower-hand', (data) => {
    const { roomId, targetUserId } = data;
    console.log(`👇 Host lower hand request from ${socket.id} for user ${targetUserId} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Verify requester is the host
    const requester = room.participants.find(p => p.socketId === socket.id);
    if (!requester || !requester.isCreator) {
      socket.emit('error', { message: 'Only the host can lower hands' });
      return;
    }

    const targetParticipant = room.participants.find(p => p.id === targetUserId);
    if (!targetParticipant) {
      socket.emit('error', { message: 'Target user not found' });
      return;
    }

    // Update target participant's hand status
    targetParticipant.isHandRaised = false;

    // Notify the target user
    io.to(targetParticipant.socketId).emit('hand-lowered-by-host', {
      roomId,
      loweredBy: requester.name,
      timestamp: Date.now()
    });

    // Notify all participants
    io.to(roomId).emit('hand-lowered', {
      userId: targetUserId,
      userName: targetParticipant.name,
      loweredByHost: true,
      loweredBy: requester.name,
      timestamp: Date.now()
    });

    console.log(`✅ Host ${requester.name} lowered hand for ${targetParticipant.name}`);
  });

  // ===== SCREEN SHARING EVENTS =====

  // User starts screen sharing
  socket.on('start-screen-share', (data) => {
    const { roomId, userName } = data;
    console.log(`📺 Screen share started by ${socket.id} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    // Update participant's screen sharing status
    participant.isScreenSharing = true;

    // Notify all participants about screen sharing
    io.to(roomId).emit('screen-share-started', {
      userId: participant.id,
      userName: participant.name,
      timestamp: Date.now()
    });

    console.log(`✅ ${participant.name} started screen sharing in room ${roomId}`);
  });

  // User stops screen sharing
  socket.on('stop-screen-share', (data) => {
    const { roomId } = data;
    console.log(`📺 Screen share stopped by ${socket.id} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    // Update participant's screen sharing status
    participant.isScreenSharing = false;

    // Notify all participants about screen sharing stop
    io.to(roomId).emit('screen-share-stopped', {
      userId: participant.id,
      userName: participant.name,
      timestamp: Date.now()
    });

    console.log(`✅ ${participant.name} stopped screen sharing in room ${roomId}`);
  });

  // ===== MEETING REACTIONS EVENTS =====

  // User sends reaction
  socket.on('send-reaction', (data) => {
    const { roomId, reaction, userName } = data;
    console.log(`😊 Reaction ${reaction} from ${socket.id} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    // Validate reaction type
    const validReactions = ['👍', '❤️', '😂', '😮', '🎉', '👏'];
    if (!validReactions.includes(reaction)) {
      socket.emit('error', { message: 'Invalid reaction type' });
      return;
    }

    // Broadcast reaction to all participants
    io.to(roomId).emit('new-reaction', {
      userId: participant.id,
      userName: participant.name,
      reaction,
      timestamp: Date.now()
    });

    console.log(`✅ ${participant.name} sent reaction ${reaction} in room ${roomId}`);
  });

  // ===== SPEAKING INDICATORS EVENTS =====

  // User audio level update
  socket.on('audio-level-update', (data) => {
    const { roomId, audioLevel, isSpeaking } = data;
    
    const room = rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) return;

    // Update participant's speaking state
    participant.isSpeaking = isSpeaking;
    participant.lastAudioLevel = audioLevel;
    participant.lastSpeakingUpdate = Date.now();

    // Broadcast speaking state to other participants
    socket.to(roomId).emit('participant-speaking-status', {
      userId: participant.id,
      userName: participant.name,
      isSpeaking,
      audioLevel,
      timestamp: Date.now()
    });
  });

  // ===== WAITING ROOM EVENTS =====

  // Host approves join request
  socket.on('approve-join-request', (data) => {
    const { roomId, participantId } = data;
    console.log(`✅ Host approving join request for ${participantId} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Verify requester is the host
    const requester = room.participants.find(p => p.socketId === socket.id);
    if (!requester || !requester.isCreator) {
      socket.emit('error', { message: 'Only the host can approve join requests' });
      return;
    }

    // Find the waiting participant
    const waitingParticipant = room.waitingList?.find(p => p.id === participantId);
    if (!waitingParticipant) {
      socket.emit('error', { message: 'Waiting participant not found' });
      return;
    }

    // Move from waiting list to approved participants
    if (room.waitingList) {
      room.waitingList = room.waitingList.filter(p => p.id !== participantId);
    }
    
    // Add to room participants
    room.participants.push({
      ...waitingParticipant,
      socketId: waitingParticipant.socketId,
      joinedAt: new Date().toISOString()
    });

    // Notify the approved participant
    io.to(waitingParticipant.socketId).emit('join-request-approved', {
      roomId,
      roomName: room.name,
      approvedBy: requester.name
    });

    // Notify other participants about new member
    io.to(roomId).emit('user-joined', {
      userName: waitingParticipant.name,
      user: {
        id: waitingParticipant.id,
        name: waitingParticipant.name,
        isHost: false
      },
      participantCount: room.participants.length
    });

    // Update waiting list for host
    io.to(socket.id).emit('waiting-list-updated', {
      waitingList: room.waitingList || [],
      count: (room.waitingList || []).length
    });

    console.log(`✅ ${waitingParticipant.name} approved to join room ${roomId}`);
  });

  // Host rejects join request
  socket.on('reject-join-request', (data) => {
    const { roomId, participantId, reason } = data;
    console.log(`❌ Host rejecting join request for ${participantId} in room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Verify requester is the host
    const requester = room.participants.find(p => p.socketId === socket.id);
    if (!requester || !requester.isCreator) {
      socket.emit('error', { message: 'Only the host can reject join requests' });
      return;
    }

    // Find the waiting participant
    const waitingParticipant = room.waitingList?.find(p => p.id === participantId);
    if (!waitingParticipant) {
      socket.emit('error', { message: 'Waiting participant not found' });
      return;
    }

    // Remove from waiting list
    if (room.waitingList) {
      room.waitingList = room.waitingList.filter(p => p.id !== participantId);
    }

    // Notify the rejected participant
    io.to(waitingParticipant.socketId).emit('join-request-rejected', {
      roomId,
      roomName: room.name,
      rejectedBy: requester.name,
      reason
    });

    // Update waiting list for host
    io.to(socket.id).emit('waiting-list-updated', {
      waitingList: room.waitingList || [],
      count: (room.waitingList || []).length
    });

    console.log(`✅ ${waitingParticipant.name} rejected from joining room ${roomId}`);
  });

  // ===== CONNECTION QUALITY EVENTS =====

  // WebRTC signaling with enhanced error handling
  socket.on('webrtc-signal', (data) => {
    const { roomId, to, signal, fromUserName, fromUserId } = data;
    
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('webrtc-error', { message: 'Room not found' });
      return;
    }

    // Validate signal data
    if (!to || !signal) {
      socket.emit('webrtc-error', { message: 'Invalid signal data' });
      return;
    }

    // Find target participant
    const targetParticipant = room.participants.find(p => p.id === to);
    if (!targetParticipant) {
      socket.emit('webrtc-error', { message: 'Target participant not found' });
      return;
    }

    // Forward signal to target
    io.to(targetParticipant.socketId).emit('webrtc-signal', {
      from: socket.id,
      fromUserName,
      fromUserId,
      signal,
      roomId,
      timestamp: Date.now()
    });
  });

  // Connection quality report
  socket.on('connection-quality-report', (data) => {
    const { roomId, quality } = data;
    
    const room = rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) return;

    // Store quality metrics (could be saved to database)
    participant.connectionQuality = quality;

    // Notify host about poor quality connections
    if (quality === 'poor') {
      const host = room.participants.find(p => p.isCreator);
      if (host && host.socketId !== socket.id) {
        io.to(host.socketId).emit('participant-poor-connection', {
          userId: participant.id,
          userName: participant.name,
          quality,
          timestamp: Date.now()
        });
      }
    }
  });

  // ===== ENHANCED EXISTING EVENTS =====

  // Enhanced room joining with waiting room support
  const originalJoinRoom = socket.on.bind(socket, 'join-room');
  socket.on('join-room', (data) => {
    const { roomId, passcode, userName, persistentUserId, joinRequest } = data;
    
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.passcode !== passcode) {
      socket.emit('error', { message: 'Invalid passcode' });
      return;
    }

    // Check if room has waiting room enabled (for future enhancement)
    const hasWaitingRoom = room.settings?.waitingRoomEnabled || false;
    
    if (hasWaitingRoom && !socket.user?.email === room.creator) {
      // Add to waiting list instead of directly joining
      if (!room.waitingList) {
        room.waitingList = [];
      }
      
      const waitingParticipant = {
        id: socket.user?.id || persistentUserId || `guest-${socket.id}`,
        name: userName,
        socketId: socket.id,
        requestedAt: Date.now()
      };
      
      room.waitingList.push(waitingParticipant);
      
      // Notify host about new waiting participant
      const host = room.participants.find(p => p.isCreator);
      if (host) {
        io.to(host.socketId).emit('new-waiting-participant', {
          participant: waitingParticipant,
          waitingCount: room.waitingList.length
        });
      }
      
      // Confirm to waiting participant
      socket.emit('waiting-for-approval', {
        roomId,
        roomName: room.name,
        position: room.waitingList.length
      });
      
      return;
    }
    
    // Continue with normal join process
    originalJoinRoom(data);
  });
}

// Export the function to be integrated into main server.js
module.exports = { setupPhase2SocketEvents };