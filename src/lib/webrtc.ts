import Peer from 'simple-peer';

export class WebRTCManager {
  private peer: Peer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;

  constructor() {
    this.setupPeer();
  }

  private setupPeer() {
    this.peer = new Peer({
      initiator: false,
      trickle: false,
      stream: this.localStream || undefined,
    });

    this.peer.on('signal', (data) => {
      console.log('Signal data:', data);
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
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: true,
      });
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async initiateCall(isInitiator: boolean, signalData?: any): Promise<void> {
    if (this.peer) {
      this.peer.destroy();
    }

    this.peer = new Peer({
      initiator: isInitiator,
      trickle: false,
      stream: this.localStream || undefined,
    });

    this.peer.on('signal', (data) => {
      console.log('Signal data to send:', data);
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