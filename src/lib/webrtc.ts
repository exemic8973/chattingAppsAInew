import SimplePeer from 'simple-peer';

type SignalPayload = { to: string; signalData: any };

interface PeerWrapper {
  peer: SimplePeer.Instance;
  remoteId: string;
}

export class MultiPeerManager {
  private peers: Map<string, PeerWrapper> = new Map();
  private pendingSignals: Map<string, any[]> = new Map();
  private localStream: MediaStream | null = null;
  private onSignalCallback: ((payload: SignalPayload) => void) | null = null;
  private onRemoteStreamCallback: ((remoteId: string, stream: MediaStream) => void) | null = null;

  // STUN servers for NAT traversal (Google public STUN servers)
  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

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

  // Create or update local media stream
  async createLocalStream(video: boolean = true): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser');
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping old tracks', e);
      }
      this.localStream = null;
      await new Promise(r => setTimeout(r, 300));
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      console.log('✅ Successfully got local media stream (video:', video ? 'yes' : 'no', ')');
      return this.localStream;
    } catch (err: any) {
      console.error('❌ getUserMedia error:', err.name, err.message);
      console.error('📍 Full error object:', err);
      
      // If video was requested but failed, try audio-only as fallback
      if (video && err.name !== 'NotAllowedError') {
        console.log('⚠️ Video failed (err.name=' + err.name + '), attempting audio-only fallback...');
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          console.log('✅ Audio-only stream acquired as fallback');
          return this.localStream;
        } catch (audioErr: any) {
          console.error('❌ Audio-only fallback also failed:', audioErr.name, audioErr.message);
          console.error('📍 Audio error details:', audioErr);
          throw new Error(`Media unavailable: ${audioErr.message || audioErr.name}`);
        }
      }
      
      // If permission denied or audio-only also failed, rethrow
      console.error('🚫 Not attempting fallback - throwing error');
      throw new Error(`Media unavailable: ${err.message || err.name}`);
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  onSignal(cb: (payload: SignalPayload) => void) {
    this.onSignalCallback = cb;
  }

  onRemoteStream(cb: (remoteId: string, stream: MediaStream) => void) {
    this.onRemoteStreamCallback = cb;
  }

  // Create a peer for a specific remote id. If a peer already exists, it will be returned.
  createPeer(remoteId: string, initiator: boolean): SimplePeer.Instance {
    if (this.peers.has(remoteId)) {
      return this.peers.get(remoteId)!.peer;
    }

    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream: this.localStream || undefined,
      config: { iceServers: this.iceServers },
      offerOptions: { offerToReceiveAudio: true, offerToReceiveVideo: true }
    });

    const wrapper: PeerWrapper = { peer, remoteId };
    this.peers.set(remoteId, wrapper);

    peer.on('signal', data => {
      // Deliver signals with target info
      if (this.onSignalCallback) {
        this.onSignalCallback({ to: remoteId, signalData: data });
      }
    });

    peer.on('stream', (stream: MediaStream) => {
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteId, stream);
      }
    });

    peer.on('connect', () => console.log(`Peer connected: ${remoteId}`));
    peer.on('close', () => {
      console.log(`Peer closed: ${remoteId}`);
      this.cleanupPeer(remoteId);
    });
    peer.on('error', (err: any) => console.error(`Peer error (${remoteId}):`, err));

    // After creating a peer, process any pending signals queued for this remote
    const pending = this.pendingSignals.get(remoteId) || [];
    if (pending.length > 0) {
      pending.forEach(s => {
        try {
          peer.signal(s);
        } catch (e) {
          console.warn('Error applying pending signal', e);
        }
      });
      this.pendingSignals.delete(remoteId);
    }

    // Try to optimize after a brief delay when the underlying RTCPeerConnection is available
    setTimeout(() => this.optimizePeerConnection(peer), 500);

    return peer;
  }

  // Initiate outgoing call to a specific remote
  async initiateCallTo(remoteId: string, initiator: boolean, signalData?: any) {
    // Ensure peer exists
    const peer = this.createPeer(remoteId, initiator);

    // If we're not the initiator and we already have an offer (signalData), apply it
    if (signalData && !initiator) {
      try {
        peer.signal(signalData);
      } catch (e) {
        console.warn('Error signaling peer with offer', e);
      }
    }
  }

  // Handle incoming signal (from server). If peer exists, signal immediately.
  // Otherwise, queue the signal and create peer later when needed (for offers we create peer automatically).
  signal(fromUserId: string, data: any) {
    const wrapper = this.peers.get(fromUserId);
    if (wrapper) {
      // Defensive: ensure peer object is valid and not destroyed
      if (!wrapper.peer || typeof (wrapper.peer as any).signal !== 'function') {
        console.warn('Existing peer object invalid, cleaning up and queuing signal for', fromUserId);
        this.cleanupPeer(fromUserId);
        const arr = this.pendingSignals.get(fromUserId) || [];
        arr.push(data);
        this.pendingSignals.set(fromUserId, arr);
        return;
      }

      try {
        wrapper.peer.signal(data);
      } catch (e) {
        console.warn('Failed to signal existing peer (will recreate peer and retry):', e);
        // Attempt a safe recovery: destroy and recreate a new non-initiator peer to apply the signal
        try {
          this.cleanupPeer(fromUserId);
          const newPeer = this.createPeer(fromUserId, false);
          newPeer.signal(data);
        } catch (e2) {
          console.warn('Recovery attempt failed, queuing signal for later:', e2);
          const arr = this.pendingSignals.get(fromUserId) || [];
          arr.push(data);
          this.pendingSignals.set(fromUserId, arr);
        }
      }
      return;
    }

    // If data looks like an SDP offer, create a peer as non-initiator and apply it
    const looksLikeOffer = data && (data.type === 'offer' || data.sdp);
    if (looksLikeOffer) {
      const newPeer = this.createPeer(fromUserId, false);
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

  private optimizePeerConnection(peer: SimplePeer.Instance) {
    try {
      const pc = (peer as any)._pc as RTCPeerConnection | undefined;
      if (!pc) return;

      const senders = pc.getSenders();
      senders.forEach(sender => {
        try {
          if (sender.track?.kind === 'video') {
            const parameters = sender.getParameters();
            if (!parameters.encodings) parameters.encodings = [{}];
            parameters.encodings[0].maxBitrate = 1500000;
            parameters.encodings[0].maxFramerate = 30;
            sender.setParameters(parameters).catch(() => {});
          } else if (sender.track?.kind === 'audio') {
            const parameters = sender.getParameters();
            if (!parameters.encodings) parameters.encodings = [{}];
            parameters.encodings[0].maxBitrate = 64000;
            sender.setParameters(parameters).catch(() => {});
          }
        } catch (e) {
          // ignore per-sender failures
        }
      });

      pc.addEventListener('iceconnectionstatechange', () => console.log('ICE state:', pc.iceConnectionState));
      pc.addEventListener('connectionstatechange', () => console.log('PC state:', pc.connectionState));
    } catch (e) {
      console.warn('optimizePeerConnection error', e);
    }
  }

  cleanupPeer(remoteId: string) {
    const wrapper = this.peers.get(remoteId);
    if (wrapper) {
      try {
        wrapper.peer.destroy();
      } catch (e) {
        console.warn('Error destroying peer', e);
      }
      this.peers.delete(remoteId);
    }
    if (this.pendingSignals.has(remoteId)) this.pendingSignals.delete(remoteId);
  }

  cleanupAll() {
    this.peers.forEach((wrapper, id) => {
      try { wrapper.peer.destroy(); } catch (e) {}
    });
    this.peers.clear();
    this.pendingSignals.clear();
    if (this.localStream) {
      try { this.localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.localStream = null;
    }
    this.onRemoteStreamCallback = null;
    this.onSignalCallback = null;
  }
}