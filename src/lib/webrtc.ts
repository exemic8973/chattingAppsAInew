import SimplePeer from 'simple-peer';

export class WebRTCManager {
  private peer: SimplePeer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onSignalCallback: ((signalData: any) => void) | null = null;

  constructor() {
    this.setupPeer();
  }

  private setupPeer() {
    this.peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: this.localStream || undefined,
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
      // Try with ideal constraints first
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: true,
      });
      return this.localStream;
    } catch (error: any) {
      console.error('Error accessing media devices with ideal constraints:', error);

      // If video is requested and failed, try with basic constraints
      if (video) {
        try {
          console.log('Retrying with basic video constraints...');
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          return this.localStream;
        } catch (fallbackError: any) {
          console.error('Error with basic video constraints:', fallbackError);

          // If still failing, try audio-only
          try {
            console.log('Video not available, falling back to audio-only...');
            this.localStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
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
      trickle: false,
      stream: this.localStream || undefined,
    });

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
  }
}