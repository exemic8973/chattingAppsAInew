declare module 'simple-peer' {
  import { EventEmitter } from 'events';

  namespace SimplePeer {
    export interface Options {
      initiator?: boolean;
      channelConfig?: RTCDataChannelInit;
      channelName?: string;
      config?: RTCConfiguration;
      offerOptions?: RTCOfferOptions;
      answerOptions?: RTCAnswerOptions;
      sdpTransform?: (sdp: string) => string;
      stream?: MediaStream;
      streams?: MediaStream[];
      trickle?: boolean;
      allowHalfTrickle?: boolean;
      wrtc?: {
        RTCPeerConnection: typeof RTCPeerConnection;
        RTCSessionDescription: typeof RTCSessionDescription;
        RTCIceCandidate: typeof RTCIceCandidate;
      };
      objectMode?: boolean;
    }

    export interface SignalData {
      type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
      sdp?: string;
      candidate?: RTCIceCandidateInit;
      renegotiate?: boolean;
      transceiverRequest?: {
        kind: string;
        init?: RTCRtpTransceiverInit;
      };
    }

    export interface Instance extends EventEmitter {
      signal(data: SignalData | string): void;
      send(data: any): void;
      addStream(stream: MediaStream): void;
      removeStream(stream: MediaStream): void;
      addTrack(track: MediaStreamTrack, stream: MediaStream): void;
      removeTrack(track: MediaStreamTrack, stream: MediaStream): void;
      replaceTrack(
        oldTrack: MediaStreamTrack,
        newTrack: MediaStreamTrack,
        stream: MediaStream
      ): void;
      addTransceiver(
        kind: string,
        init?: RTCRtpTransceiverInit
      ): RTCRtpTransceiver;
      destroy(err?: Error): void;
      readonly destroyed: boolean;
      readonly connected: boolean;
      address(): { port: string; family: string; address: string } | {};

      on(event: 'signal', listener: (data: SignalData) => void): this;
      on(event: 'connect', listener: () => void): this;
      on(event: 'data', listener: (data: Buffer) => void): this;
      on(event: 'stream', listener: (stream: MediaStream) => void): this;
      on(event: 'track', listener: (track: MediaStreamTrack, stream: MediaStream) => void): this;
      on(event: 'close', listener: () => void): this;
      on(event: 'error', listener: (err: Error) => void): this;
      on(event: string, listener: Function): this;
    }
  }

  interface SimplePeer {
    (opts?: SimplePeer.Options): SimplePeer.Instance;
    new (opts?: SimplePeer.Options): SimplePeer.Instance;
    WEBRTC_SUPPORT: boolean;
  }

  const SimplePeer: SimplePeer;
  export = SimplePeer;
}
