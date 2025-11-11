import SimplePeer from 'simple-peer';

export class WebRTCManager {
  private peer: SimplePeer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onSignalCallback: ((signalData: any) => void) | null = null;

  // STUN servers for NAT traversal (free Google STUN servers)
  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  constructor() {
    this.setupPeer();
  }

  private setupPeer() {
    this.peer = new SimplePeer({
      initiator: false,
      trickle: true, // Enable trickle ICE for faster connection
      stream: this.localStream || undefined,
      config: {
        iceServers: this.iceServers
      }
    });

    this.peer.on('signal', (data) => {
      console.log('Signal data:', data);
      if (this.onSignalCallback) {
        this.onSignalCallback(data);
      }
    });

    this.peer.on('stream', (stream) => {
      this.remoteStream = stream;
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(stream);
      }
    });

    this.peer.on('connect', () => {
      console.log('Peer connected');
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      this.cleanup();
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
    });
  }

  async createLocalStream(video: boolean = true): Promise<MediaStream> {
    try {
      // Optimized constraints for quality and bandwidth
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 }, // 30fps is sufficient for calls
          facingMode: 'user'
        } : false,
        audio: {
          echoCancellation: true,     // Remove echo
          noiseSuppression: true,      // Remove background noise
          autoGainControl: true,       // Normalize volume
          sampleRate: 48000,          // High quality audio (Opus ideal rate)
          channelCount: 1             // Mono is enough for calls, saves bandwidth
        }
      });
      return this.localStream;
    } catch (error: any) {
      console.error('Error accessing media devices with ideal constraints:', error);

      // If video is requested and failed, try with basic constraints
      if (video) {
        try {
          console.log('Retrying with basic video constraints...');
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 24 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1
            }
          });
          return this.localStream;
        } catch (fallbackError: any) {
          console.error('Error with basic video constraints:', fallbackError);

          // If still failing, try audio-only
          try {
            console.log('Video not available, falling back to audio-only...');
            this.localStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 1
              }
            });
            return this.localStream;
          } catch (audioError: any) {
            console.error('Error accessing audio:', audioError);
            throw new Error('No camera or microphone found. Please check your device permissions and hardware.');
          }
        }
      } else {
        // For audio-only calls, just throw the error with a helpful message
        throw new Error('No microphone found. Please check your device permissions and ensure a microphone is connected.');
      }
    }
  }

  async initiateCall(isInitiator: boolean, signalData?: any): Promise<void> {
    if (this.peer) {
      this.peer.destroy();
    }

    this.peer = new SimplePeer({
      initiator: isInitiator,
      trickle: true, // Enable trickle ICE for faster connection
      stream: this.localStream || undefined,
      config: {
        iceServers: this.iceServers
      },
      // Optimize for better codec selection
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      },
      answerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }
    });

    // Apply bandwidth and codec optimizations after peer is created
    this.optimizePeerConnection();

    this.peer.on('signal', (data) => {
      console.log('Signal data to send:', data);
      if (this.onSignalCallback) {
        this.onSignalCallback(data);
      }
    });

    this.peer.on('stream', (stream) => {
      this.remoteStream = stream;
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(stream);
      }
    });

    this.peer.on('connect', () => {
      console.log('Peer connected');
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      this.cleanup();
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    if (signalData && !isInitiator) {
      this.peer.signal(signalData);
    }
  }

  signal(data: any): void {
    if (this.peer) {
      this.peer.signal(data);
    }
  }

  getSignalData(): any {
    return this.peer ? (this.peer as any)._lastSignal : null;
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
    if (this.remoteStream) {
      callback(this.remoteStream);
    }
  }

  onSignal(callback: (signalData: any) => void): void {
    this.onSignalCallback = callback;
  }

  private optimizePeerConnection(): void {
    if (!this.peer || !(this.peer as any)._pc) return;

    const pc = (this.peer as any)._pc as RTCPeerConnection;

    // Optimize bandwidth for video (save data while maintaining quality)
    const senders = pc.getSenders();
    senders.forEach(sender => {
      if (sender.track?.kind === 'video') {
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        // Limit max bitrate to 1.5 Mbps for video (good quality, reasonable data)
        parameters.encodings[0].maxBitrate = 1500000; // 1.5 Mbps
        parameters.encodings[0].maxFramerate = 30;
        sender.setParameters(parameters).catch(err =>
          console.warn('Failed to set video parameters:', err)
        );
      } else if (sender.track?.kind === 'audio') {
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        // Limit audio bitrate to 64 kbps (excellent quality for voice)
        parameters.encodings[0].maxBitrate = 64000; // 64 kbps
        sender.setParameters(parameters).catch(err =>
          console.warn('Failed to set audio parameters:', err)
        );
      }
    });

    // Monitor connection quality
    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    });

    pc.addEventListener('connectionstatechange', () => {
      console.log('Connection state:', pc.connectionState);
    });
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.remoteStream = null;
    this.onRemoteStreamCallback = null;
    this.onSignalCallback = null; // Prevent memory leaks
  }
}