/**
 * Enhanced Multi-Peer WebRTC Manager
 * Supports 3+ person calls with advanced features
 */

import SimplePeer from 'simple-peer';

// Enhanced types for Phase 2 features
interface PeerWrapper {
  peer: SimplePeer.Instance;
  remoteId: string;
  userName?: string;
  isHost?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  lastActivity?: number;
  reconnectAttempts: number;
}

interface SignalPayload {
  to: string;
  signalData: any;
  fromUserName?: string;
  fromUserId?: string;
  timestamp?: number;
}

interface EnhancedMediaConstraints {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  screen?: boolean;
}

interface ConnectionQualityMetrics {
  packetLoss: number;
  latency: number;
  jitter: number;
  bitrate: number;
  timestamp: number;
}

export class EnhancedMultiPeerManager {
  private peers: Map<string, PeerWrapper> = new Map();
  private pendingSignals: Map<string, any[]> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private onSignalCallback: ((payload: SignalPayload) => void) | null = null;
  private onRemoteStreamCallback: ((remoteId: string, stream: MediaStream, userName?: string) => void) | null = null;
  private onConnectionStateChangeCallback: ((remoteId: string, state: string) => void) | null = null;
  private onQualityMetricsCallback: ((remoteId: string, metrics: ConnectionQualityMetrics) => void) | null = null;
  private connectionMetrics: Map<string, ConnectionQualityMetrics[]> = new Map();
  
  // Enhanced STUN/TURN servers for better connectivity
  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Add TURN servers for production (should be configured via environment)
    ...(process.env.NEXT_PUBLIC_TURN_SERVER ? [{
      urls: process.env.NEXT_PUBLIC_TURN_SERVER,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    }] : [])
  ];

  // Configuration for different scenarios
  private readonly config = {
    maxReconnectAttempts: 3,
    reconnectDelay: 1000,
    connectionTimeout: 30000,
    qualityCheckInterval: 5000,
    maxPeers: 20, // Support up to 20 participants
    videoBitrate: 1500000, // 1.5 Mbps
    audioBitrate: 64000,   // 64 kbps
    screenBitrate: 3000000 // 3 Mbps for screen sharing
  };

  constructor() {
    // Start connection quality monitoring
    this.startQualityMonitoring();
  }

  static async checkMediaDeviceSupport(): Promise<{
    supported: boolean;
    hasAudioDevices: boolean;
    hasVideoDevices: boolean;
    audioDevices: MediaDeviceInfo[];
    videoDevices: MediaDeviceInfo[];
    error?: string;
  }> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        supported: false,
        hasAudioDevices: false,
        hasVideoDevices: false,
        audioDevices: [],
        videoDevices: [],
        error: 'Your browser does not support media devices.'
      };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      return {
        supported: true,
        hasAudioDevices: audioDevices.length > 0,
        hasVideoDevices: videoDevices.length > 0,
        audioDevices,
        videoDevices
      };
    } catch (error: any) {
      return {
        supported: true,
        hasAudioDevices: false,
        hasVideoDevices: false,
        audioDevices: [],
        videoDevices: [],
        error: 'Cannot detect devices. This may be due to browser permissions.'
      };
    }
  }

  // Enhanced local stream creation with better error handling
  async createLocalStream(constraints: EnhancedMediaConstraints = {}): Promise<MediaStream> {
    const video = constraints.video !== undefined ? constraints.video : true;
    const audio = constraints.audio !== undefined ? constraints.audio : true;
    const screen = constraints.screen || false;

    // Stop existing streams first
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (screen) {
      return this.createScreenStream();
    }

    try {
      const streamConstraints: MediaStreamConstraints = {
        video: video ? {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
      
      // Apply bitrate constraints
      this.applyBitrateConstraints(this.localStream, 'camera');
      
      console.log('✅ Successfully created local media stream');
      return this.localStream;
    } catch (err: any) {
      console.error('❌ getUserMedia error:', err.name, err.message);
      
      // Try fallback strategies
      if (video && err.name !== 'NotAllowedError') {
        console.log('⚠️ Trying audio-only fallback...');
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          console.log('✅ Audio-only stream acquired as fallback');
          return this.localStream;
        } catch (audioErr: any) {
          console.error('❌ Audio-only fallback also failed:', audioErr.name, audioErr.message);
          throw new Error(`Media unavailable: ${audioErr.message || audioErr.name}`);
        }
      }
      
      throw new Error(`Media unavailable: ${err.message || err.name}`);
    }
  }

  // Screen sharing stream creation
  async createScreenStream(): Promise<MediaStream> {
    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser');
      }

      const screenConstraints: any = {
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.screenStream = await navigator.mediaDevices.getDisplayMedia(screenConstraints);
      
      // Apply higher bitrate for screen sharing
      this.applyBitrateConstraints(this.screenStream, 'screen');
      
      // Handle screen share ending
      this.screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        console.log('📺 Screen sharing ended');
        this.stopScreenShare();
      });

      console.log('✅ Successfully created screen sharing stream');
      return this.screenStream;
    } catch (err: any) {
      console.error('❌ Screen sharing error:', err.name, err.message);
      throw new Error(`Screen sharing unavailable: ${err.message || err.name}`);
    }
  }

  // Apply bitrate constraints based on stream type
  private applyBitrateConstraints(stream: MediaStream, type: 'camera' | 'screen' | 'audio'): void {
    const tracks = stream.getTracks();
    
    tracks.forEach(track => {
      if (track.kind === 'video') {
        const sender = this.getSenders().find(s => s.track === track);
        if (sender) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) parameters.encodings = [{}];
          
          if (type === 'screen') {
            parameters.encodings[0].maxBitrate = this.config.screenBitrate;
          } else {
            parameters.encodings[0].maxBitrate = this.config.videoBitrate;
            parameters.encodings[0].maxFramerate = 30;
          }
          
          sender.setParameters(parameters).catch(console.warn);
        }
      } else if (track.kind === 'audio') {
        const sender = this.getSenders().find(s => s.track === track);
        if (sender) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) parameters.encodings = [{}];
          parameters.encodings[0].maxBitrate = this.config.audioBitrate;
          sender.setParameters(parameters).catch(console.warn);
        }
      }
    });
  }

  // Get all RTCRtpSenders from all peer connections
  private getSenders(): RTCRtpSender[] {
    const senders: RTCRtpSender[] = [];
    this.peers.forEach(wrapper => {
      const pc = (wrapper.peer as any)._pc as RTCPeerConnection;
      if (pc) {
        senders.push(...pc.getSenders());
      }
    });
    return senders;
  }

  // Enhanced peer creation with better connection management
  createPeer(remoteId: string, userName?: string, isHost?: boolean, initiator: boolean = false): SimplePeer.Instance {
    // Check if we already have a peer for this remote ID
    const existingPeer = this.peers.get(remoteId);
    if (existingPeer) {
      console.log(`Peer already exists for ${remoteId}, returning existing peer`);
      return existingPeer.peer;
    }

    // Check max peers limit
    if (this.peers.size >= this.config.maxPeers) {
      throw new Error(`Maximum number of peers (${this.config.maxPeers}) reached`);
    }

    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream: this.localStream || undefined,
      config: { 
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      },
      offerOptions: { 
        offerToReceiveAudio: true, 
        offerToReceiveVideo: true 
      }
    });

    const wrapper: PeerWrapper = {
      peer,
      remoteId,
      userName,
      isHost,
      isMuted: false,
      isVideoOff: false,
      connectionState: 'connecting',
      reconnectAttempts: 0,
      lastActivity: Date.now()
    };

    this.peers.set(remoteId, wrapper);

    // Set up peer event handlers
    this.setupPeerEventHandlers(peer, remoteId);

    // Process any pending signals for this remote ID
    this.processPendingSignals(remoteId);

    return peer;
  }

  // Set up comprehensive event handlers for a peer
  private setupPeerEventHandlers(peer: SimplePeer.Instance, remoteId: string): void {
    const wrapper = this.peers.get(remoteId);
    if (!wrapper) return;

    peer.on('signal', (data) => {
      if (this.onSignalCallback) {
        this.onSignalCallback({
          to: remoteId,
          signalData: data,
          fromUserName: wrapper.userName,
          fromUserId: remoteId,
          timestamp: Date.now()
        });
      }
    });

    peer.on('stream', (stream: MediaStream) => {
      console.log(`📹 Received stream from ${remoteId}`);
      wrapper.connectionState = 'connected';
      wrapper.lastActivity = Date.now();
      
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteId, stream, wrapper.userName);
      }
    });

    peer.on('connect', () => {
      console.log(`✅ Peer connected: ${remoteId}`);
      wrapper.connectionState = 'connected';
      wrapper.reconnectAttempts = 0;
      wrapper.lastActivity = Date.now();
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(remoteId, 'connected');
      }
    });

    peer.on('close', () => {
      console.log(`🔌 Peer closed: ${remoteId}`);
      wrapper.connectionState = 'disconnected';
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(remoteId, 'disconnected');
      }
      
      // Attempt reconnection if appropriate
      this.attemptReconnection(remoteId);
    });

    peer.on('error', (err: any) => {
      console.error(`❌ Peer error (${remoteId}):`, err);
      wrapper.connectionState = 'failed';
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(remoteId, 'failed');
      }
      
      // Attempt reconnection on certain errors
      if (err.code === 'ERR_WEBRTC_SUPPORT' || err.code === 'ERR_CONNECTION_FAILURE') {
        this.attemptReconnection(remoteId);
      }
    });

    // Monitor connection quality
    this.monitorConnectionQuality(peer, remoteId);
  }

  // Attempt to reconnect a failed peer
  private attemptReconnection(remoteId: string): void {
    const wrapper = this.peers.get(remoteId);
    if (!wrapper || wrapper.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log(`Max reconnection attempts reached for ${remoteId}, cleaning up`);
      this.cleanupPeer(remoteId);
      return;
    }

    wrapper.reconnectAttempts++;
    console.log(`🔄 Attempting reconnection ${wrapper.reconnectAttempts}/${this.config.maxReconnectAttempts} for ${remoteId}`);

    setTimeout(() => {
      if (wrapper.connectionState === 'disconnected' || wrapper.connectionState === 'failed') {
        // Create new peer for reconnection
        const newPeer = this.createPeer(remoteId, wrapper.userName, wrapper.isHost, true);
        
        // If we have pending signals, process them
        const pending = this.pendingSignals.get(remoteId) || [];
        if (pending.length > 0) {
          pending.forEach(signal => {
            try {
              newPeer.signal(signal);
            } catch (e) {
              console.warn('Error signaling during reconnection:', e);
            }
          });
          this.pendingSignals.delete(remoteId);
        }
      }
    }, this.config.reconnectDelay * wrapper.reconnectAttempts);
  }

  // Monitor connection quality metrics
  private monitorConnectionQuality(peer: SimplePeer.Instance, remoteId: string): void {
    const checkQuality = async () => {
      try {
        const pc = (peer as any)._pc as RTCPeerConnection;
        if (!pc || pc.connectionState !== 'connected') return;

        const stats = await pc.getStats();
        let videoStats: any = null;
        let audioStats: any = null;

        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp') {
            if (report.mediaType === 'video') {
              videoStats = report;
            } else if (report.mediaType === 'audio') {
              audioStats = report;
            }
          }
        });

        if (videoStats) {
          const metrics: ConnectionQualityMetrics = {
            packetLoss: videoStats.packetsLost / (videoStats.packetsReceived + videoStats.packetsLost) * 100,
            latency: videoStats.roundTripTime * 1000 || 0,
            jitter: videoStats.jitter * 1000 || 0,
            bitrate: (videoStats.bytesReceived * 8) / (videoStats.timestamp - (videoStats.timestamp - 1000)),
            timestamp: Date.now()
          };

          // Store metrics
          if (!this.connectionMetrics.has(remoteId)) {
            this.connectionMetrics.set(remoteId, []);
          }
          const metricsArray = this.connectionMetrics.get(remoteId)!;
          metricsArray.push(metrics);
          
          // Keep only last 10 metrics
          if (metricsArray.length > 10) {
            metricsArray.shift();
          }

          // Determine connection quality
          const wrapper = this.peers.get(remoteId);
          if (wrapper) {
            wrapper.connectionQuality = this.calculateConnectionQuality(metrics);
          }

          // Notify callback
          if (this.onQualityMetricsCallback) {
            this.onQualityMetricsCallback(remoteId, metrics);
          }
        }
      } catch (error) {
        console.warn('Error monitoring connection quality:', error);
      }
    };

    // Check quality every 5 seconds
    setInterval(checkQuality, this.config.qualityCheckInterval);
  }

  // Calculate overall connection quality
  private calculateConnectionQuality(metrics: ConnectionQualityMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
    const { packetLoss, latency, jitter } = metrics;
    
    if (packetLoss < 1 && latency < 100 && jitter < 30) return 'excellent';
    if (packetLoss < 3 && latency < 200 && jitter < 50) return 'good';
    if (packetLoss < 5 && latency < 300 && jitter < 100) return 'fair';
    return 'poor';
  }

  // Start quality monitoring
  private startQualityMonitoring(): void {
    setInterval(() => {
      this.peers.forEach((wrapper, remoteId) => {
        if (wrapper.connectionState === 'connected') {
          // Check for stale connections
          const lastActivity = wrapper.lastActivity || 0;
          const timeSinceLastActivity = Date.now() - lastActivity;
          
          if (timeSinceLastActivity > this.config.connectionTimeout) {
            console.warn(`Connection to ${remoteId} appears stale, last activity ${timeSinceLastActivity}ms ago`);
            wrapper.connectionState = 'disconnected';
            this.attemptReconnection(remoteId);
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  // Process pending signals for a remote ID
  private processPendingSignals(remoteId: string): void {
    const pending = this.pendingSignals.get(remoteId) || [];
    if (pending.length > 0) {
      const wrapper = this.peers.get(remoteId);
      if (wrapper) {
        pending.forEach(signal => {
          try {
            wrapper.peer.signal(signal);
          } catch (e) {
            console.warn('Error applying pending signal:', e);
          }
        });
      }
      this.pendingSignals.delete(remoteId);
    }
  }

  // Enhanced signal handling with better error recovery
  signal(fromUserId: string, data: any): void {
    const wrapper = this.peers.get(fromUserId);
    
    if (wrapper) {
      try {
        wrapper.peer.signal(data);
        wrapper.lastActivity = Date.now();
      } catch (e) {
        console.warn('Failed to signal existing peer, will attempt recovery:', e);
        this.attemptReconnection(fromUserId);
      }
      return;
    }

    // If data looks like an SDP offer, create a peer as non-initiator and apply it
    const looksLikeOffer = data && (data.type === 'offer' || data.sdp);
    if (looksLikeOffer) {
      const newPeer = this.createPeer(fromUserId, undefined, undefined, false);
      try {
        newPeer.signal(data);
      } catch (e) {
        console.warn('Error signaling newly created peer with offer:', e);
      }
      return;
    }

    // Otherwise queue the signal until a peer exists
    const arr = this.pendingSignals.get(fromUserId) || [];
    arr.push(data);
    this.pendingSignals.set(fromUserId, arr);
  }

  // Screen sharing methods
  async startScreenShare(): Promise<MediaStream> {
    const screenStream = await this.createScreenStream();
    
    // Replace video track in all peer connections
    this.peers.forEach((wrapper, remoteId) => {
      const pc = (wrapper.peer as any)._pc as RTCPeerConnection;
      if (pc) {
        const sender = pc.getSenders().find((s: RTCRtpSender) => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }
      }
    });

    return screenStream;
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Restore camera stream if available
    if (this.localStream) {
      this.peers.forEach((wrapper, remoteId) => {
        const pc = (wrapper.peer as any)._pc as RTCPeerConnection;
        if (pc) {
          const sender = pc.getSenders().find((s: RTCRtpSender) => 
            s.track && s.track.kind === 'video'
          );
          if (sender && this.localStream) {
            sender.replaceTrack(this.localStream.getVideoTracks()[0]);
          }
        }
      });
    }
  }

  // Get connection quality for a specific peer
  getConnectionQuality(remoteId: string): 'excellent' | 'good' | 'fair' | 'poor' | undefined {
    const wrapper = this.peers.get(remoteId);
    return wrapper?.connectionQuality;
  }

  // Get all connection metrics
  getConnectionMetrics(): Map<string, ConnectionQualityMetrics[]> {
    return new Map(this.connectionMetrics);
  }

  // Get peer information
  getPeerInfo(remoteId: string): Partial<PeerWrapper> | undefined {
    const wrapper = this.peers.get(remoteId);
    if (!wrapper) return undefined;

    return {
      remoteId: wrapper.remoteId,
      userName: wrapper.userName,
      isHost: wrapper.isHost,
      isMuted: wrapper.isMuted,
      isVideoOff: wrapper.isVideoOff,
      connectionState: wrapper.connectionState,
      connectionQuality: wrapper.connectionQuality,
      lastActivity: wrapper.lastActivity
    };
  }

  // Get all peers information
  getAllPeersInfo(): Partial<PeerWrapper>[] {
    return Array.from(this.peers.values()).map(wrapper => ({
      remoteId: wrapper.remoteId,
      userName: wrapper.userName,
      isHost: wrapper.isHost,
      isMuted: wrapper.isMuted,
      isVideoOff: wrapper.isVideoOff,
      connectionState: wrapper.connectionState,
      connectionQuality: wrapper.connectionQuality,
      lastActivity: wrapper.lastActivity
    }));
  }

  // Update peer metadata
  updatePeerMetadata(remoteId: string, metadata: Partial<PeerWrapper>): void {
    const wrapper = this.peers.get(remoteId);
    if (wrapper) {
      Object.assign(wrapper, metadata);
    }
  }

  // Set callback functions
  onSignal(cb: (payload: SignalPayload) => void) {
    this.onSignalCallback = cb;
  }

  onRemoteStream(cb: (remoteId: string, stream: MediaStream, userName?: string) => void) {
    this.onRemoteStreamCallback = cb;
  }

  onConnectionStateChange(cb: (remoteId: string, state: string) => void) {
    this.onConnectionStateChangeCallback = cb;
  }

  onQualityMetrics(cb: (remoteId: string, metrics: ConnectionQualityMetrics) => void) {
    this.onQualityMetricsCallback = cb;
  }

  // Getters
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  // Enhanced cleanup
  cleanupPeer(remoteId: string): void {
    const wrapper = this.peers.get(remoteId);
    if (wrapper) {
      try {
        wrapper.peer.destroy();
      } catch (e) {
        console.warn('Error destroying peer:', e);
      }
      this.peers.delete(remoteId);
      this.connectionMetrics.delete(remoteId);
      this.pendingSignals.delete(remoteId);
    }
  }

  // Complete cleanup
  cleanupAll(): void {
    console.log('🧹 Cleaning up all peers and streams');
    
    this.peers.forEach((wrapper, id) => {
      try {
        wrapper.peer.destroy();
      } catch (e) {
        console.warn('Error destroying peer during cleanup:', e);
      }
    });
    
    this.peers.clear();
    this.connectionMetrics.clear();
    this.pendingSignals.clear();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    this.onSignalCallback = null;
    this.onRemoteStreamCallback = null;
    this.onConnectionStateChangeCallback = null;
    this.onQualityMetricsCallback = null;
  }
}

export default EnhancedMultiPeerManager;