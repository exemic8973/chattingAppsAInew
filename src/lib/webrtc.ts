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

  /**
   * Check if browser supports media devices and enumerate available devices
   * @returns Object with device availability and permission status
   */
  static async checkMediaDeviceSupport(): Promise<{
    supported: boolean;
    hasAudioDevices: boolean;
    hasVideoDevices: boolean;
    audioDevices: MediaDeviceInfo[];
    videoDevices: MediaDeviceInfo[];
    error?: string;
  }> {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        supported: false,
        hasAudioDevices: false,
        hasVideoDevices: false,
        audioDevices: [],
        videoDevices: [],
        error: 'Your browser does not support media devices. Please use a modern browser like Chrome, Firefox, or Edge.'
      };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      console.log('📹 Media device check:');
      console.log(`  Audio devices: ${audioDevices.length}`);
      console.log(`  Video devices: ${videoDevices.length}`);

      return {
        supported: true,
        hasAudioDevices: audioDevices.length > 0,
        hasVideoDevices: videoDevices.length > 0,
        audioDevices,
        videoDevices
      };
    } catch (error: any) {
      console.error('Error enumerating devices:', error);
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
    // First check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('❌ getUserMedia not supported in this browser');
      throw new Error('Your browser does not support media devices. Please use a modern browser like Chrome, Firefox, or Edge.');
    }

    // 🔥 CRITICAL FIX: Stop existing stream before creating new one
    if (this.localStream) {
      console.log('🧹 Cleaning up existing local stream before creating new one...');
      this.localStream.getTracks().forEach(track => {
        console.log(`  Stopping ${track.kind} track:`, track.label);
        track.stop();
      });
      this.localStream = null;

      // Give the browser time to release the devices
      console.log('⏳ Waiting for devices to be released...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Log available devices for debugging
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      console.log(`📹 Available devices - Audio: ${audioDevices.length}, Video: ${videoDevices.length}`);
      console.log('Audio devices:', audioDevices.map(d => d.label || 'Unnamed device'));
      console.log('Video devices:', videoDevices.map(d => d.label || 'Unnamed device'));

      if (audioDevices.length === 0) {
        console.warn('⚠️ No audio input devices found!');
      }
      if (video && videoDevices.length === 0) {
        console.warn('⚠️ No video input devices found!');
      }
    } catch (enumError) {
      console.warn('Could not enumerate devices:', enumError);
    }

    try {
      console.log(`🎯 Requesting media stream - Video: ${video}, Audio: true`);

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

      console.log('✅ Media stream obtained successfully');
      console.log('Audio tracks:', this.localStream.getAudioTracks().length);
      console.log('Video tracks:', this.localStream.getVideoTracks().length);

      return this.localStream;
    } catch (error: any) {
      console.error('❌ Error accessing media devices with ideal constraints:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);

      // Check for specific permission errors
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Permission denied. Please click "Allow" when your browser asks for camera/microphone access, or check your browser settings to enable permissions for this site.');
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        // Check if this is a "device in use" or "device not accessible" error
        if (error.message && error.message.toLowerCase().includes('not found')) {
          throw new Error('Cannot access camera/microphone. Please check:\n1. Close other apps that might be using your camera/microphone (Zoom, Teams, Discord, Skype, etc.)\n2. Make sure your devices are properly connected\n3. Try refreshing the page and allowing permissions when prompted\n4. Check if your camera/microphone are working in other applications');
        }

        if (video) {
          throw new Error('No camera or microphone found. Please connect a camera and microphone, then try again.');
        } else {
          throw new Error('No microphone found. Please connect a microphone, then try again.');
        }
      }

      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Cannot access camera/microphone. They might be in use by another application. Please close other apps using your camera/microphone and try again.');
      }

      if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        console.log('Constraints too strict, will retry with basic constraints...');
      } else {
        // Unknown error, log and continue to fallback
        console.error('Unknown error type, trying fallback...');
      }

      // If video is requested and failed, try with basic constraints
      if (video) {
        try {
          console.log('🔄 Retrying with basic video constraints...');
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
          console.log('✅ Media stream obtained with basic constraints');
          return this.localStream;
        } catch (fallbackError: any) {
          console.error('❌ Error with basic video constraints:', fallbackError);
          console.error('Fallback error name:', fallbackError.name);
          console.error('Fallback error message:', fallbackError.message);

          // If still failing, try audio-only
          try {
            console.log('🔄 Video not available, falling back to audio-only...');
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
            console.log('✅ Audio-only stream obtained');
            return this.localStream;
          } catch (audioError: any) {
            console.error('❌ Error accessing audio:', audioError);
            console.error('Audio error name:', audioError.name);
            console.error('Audio error message:', audioError.message);

            if (audioError.name === 'NotAllowedError' || audioError.name === 'PermissionDeniedError') {
              throw new Error('Microphone permission denied. Please:\n1. Click "Allow" when your browser asks for microphone access\n2. Or check your browser settings (usually a camera icon in the address bar)\n3. Make sure microphone permissions are enabled for this site');
            }

            throw new Error('Cannot access microphone. Please check:\n1. A microphone is connected to your computer\n2. Your browser has permission to use the microphone\n3. The microphone is not being used by another application');
          }
        }
      } else {
        // For audio-only calls, provide detailed error message
        console.error('❌ Audio-only call failed on first attempt');

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied. Please:\n1. Click "Allow" when your browser asks for microphone access\n2. Or check your browser settings (usually a camera icon in the address bar)\n3. Make sure microphone permissions are enabled for this site');
        }

        throw new Error('Cannot access microphone. Please check:\n1. A microphone is connected to your computer\n2. Your browser has permission to use the microphone\n3. The microphone is not being used by another application');
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