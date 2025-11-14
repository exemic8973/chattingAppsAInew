'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSocket } from '@/lib/socket';
import { useLanguage } from '@/contexts/LanguageContext';

interface PreJoinScreenProps {
  roomId: string;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

export default function PreJoinScreen({ roomId }: PreJoinScreenProps) {
  const { t } = useLanguage();
  const router = useRouter();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Device state
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Device selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  // Device permissions & support
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  const [hasVideoPermission, setHasVideoPermission] = useState<boolean | null>(null);
  const [deviceError, setDeviceError] = useState<string>('');

  // Audio visualization
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load saved preferences
  useEffect(() => {
    const savedName = localStorage.getItem('displayName');
    const savedAudioEnabled = localStorage.getItem('audioEnabled');
    const savedVideoEnabled = localStorage.getItem('videoEnabled');

    if (savedName) setDisplayName(savedName);
    if (savedAudioEnabled !== null) setAudioEnabled(savedAudioEnabled === 'true');
    if (savedVideoEnabled !== null) setVideoEnabled(savedVideoEnabled === 'true');
  }, []);

  // Enumerate devices
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }));

      const videoInputs = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
          kind: device.kind
        }));

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Set default devices if not already selected
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }

      console.log('📱 Devices enumerated:', { audioInputs, videoInputs });
    } catch (error) {
      console.error('❌ Error enumerating devices:', error);
      setDeviceError('Could not access device list');
    }
  };

  // Initialize media stream
  const initializeMediaStream = async () => {
    try {
      // Stop any existing stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: audioEnabled ? {
          deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: videoEnabled ? {
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } : false
      };

      console.log('🎥 Requesting media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setLocalStream(stream);

      // Set permissions
      if (stream.getAudioTracks().length > 0) {
        setHasAudioPermission(true);
      }
      if (stream.getVideoTracks().length > 0) {
        setHasVideoPermission(true);
      }

      // Attach video to video element
      if (videoRef.current && videoEnabled) {
        videoRef.current.srcObject = stream;
      }

      // Setup audio level monitoring
      if (audioEnabled && stream.getAudioTracks().length > 0) {
        setupAudioMonitoring(stream);
      }

      console.log('✅ Media stream initialized');
      setDeviceError('');
    } catch (error: any) {
      console.error('❌ Error accessing media devices:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setDeviceError('Camera/microphone access denied. Please allow access in your browser settings.');
        if (audioEnabled) setHasAudioPermission(false);
        if (videoEnabled) setHasVideoPermission(false);
      } else if (error.name === 'NotFoundError') {
        setDeviceError('No camera or microphone found on your device.');
      } else if (error.name === 'NotReadableError') {
        setDeviceError('Your camera or microphone is already in use by another application.');
      } else {
        setDeviceError(`Error accessing devices: ${error.message}`);
      }
    }
  };

  // Setup audio level monitoring
  const setupAudioMonitoring = (stream: MediaStream) => {
    try {
      // Clean up previous audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Monitor audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const detectAudio = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, average * 2)); // Scale to 0-100

        animationFrameRef.current = requestAnimationFrame(detectAudio);
      };

      detectAudio();
    } catch (error) {
      console.error('❌ Error setting up audio monitoring:', error);
    }
  };

  // Initialize devices on mount
  useEffect(() => {
    enumerateDevices();
  }, []);

  // Update media stream when settings change
  useEffect(() => {
    if (audioEnabled || videoEnabled) {
      initializeMediaStream();
    } else {
      // Stop stream if both disabled
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }

    return () => {
      // Cleanup on unmount
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioEnabled, videoEnabled, selectedAudioDevice, selectedVideoDevice]);

  // Toggle video
  const toggleVideo = () => {
    const newState = !videoEnabled;
    setVideoEnabled(newState);
    localStorage.setItem('videoEnabled', String(newState));
  };

  // Toggle audio
  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    localStorage.setItem('audioEnabled', String(newState));
  };

  // Handle join room
  const handleJoinRoom = async () => {
    if (!displayName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!passcode.trim()) {
      alert('Please enter the passcode');
      return;
    }

    // Save preferences
    localStorage.setItem('displayName', displayName.trim());

    console.log(`🚪 Joining room: ${roomId} as ${displayName}`);
    setIsJoining(true);

    try {
      const socket = initializeSocket();

      // Wait for socket connection
      if (!socket.connected) {
        console.log('🔌 Waiting for socket connection...');
        await new Promise((resolve) => {
          socket.once('connect', () => {
            console.log('✅ Socket connected');
            resolve(void 0);
          });
        });
      }

      // Setup event listeners
      socket.once('room-joined', ({ users, messages }) => {
        console.log(`✅ Successfully joined room: ${roomId}`);

        // Stop preview stream (will be recreated in ChatRoom)
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }

        // Navigate to room with params
        const params = new URLSearchParams({
          name: displayName.trim(),
          passcode: passcode,
          videoEnabled: String(videoEnabled),
          audioEnabled: String(audioEnabled)
        });

        router.push(`/room/${roomId}?${params.toString()}`);
      });

      socket.once('error', (error: any) => {
        console.error('❌ Socket error during room join:', error);
        alert(error?.message || 'Failed to join room');
        setIsJoining(false);
      });

      // Emit join request
      const persistentUserId = localStorage.getItem('socketUserId');
      socket.emit('join-room', {
        roomId,
        passcode,
        userName: displayName.trim(),
        persistentUserId
      });

      // Timeout safety
      setTimeout(() => {
        if (isJoining) {
          console.log('⏰ Join timeout');
          alert('Connection timeout - please try again');
          setIsJoining(false);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ Error joining room:', error);
      alert('Failed to join room: ' + (error as Error).message);
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen d-flex align-items-center justify-content-center p-4" style={{ background: '#1f1f1f' }}>
      <div className="card border-0 shadow-lg" style={{ maxWidth: '900px', width: '100%', background: '#292929', color: '#fff' }}>
        <div className="card-body p-4 p-md-5">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="h3 mb-2">
              <i className="bi bi-camera-video-fill text-primary me-2"></i>
              Join Meeting
            </h1>
            <p className="text-secondary mb-0">Room: <span className="badge bg-primary">{roomId}</span></p>
          </div>

          <div className="row g-4">
            {/* Left Column - Video Preview */}
            <div className="col-md-7">
              <div className="preview-container position-relative rounded overflow-hidden" style={{ background: '#000', aspectRatio: '4/3' }}>
                {videoEnabled && hasVideoPermission ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-100 h-100"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center p-4">
                    <div className="avatar-placeholder bg-primary rounded-circle d-flex align-items-center justify-content-center mb-3"
                         style={{ width: '120px', height: '120px', fontSize: '48px' }}>
                      {displayName.charAt(0).toUpperCase() || '?'}
                    </div>
                    <p className="text-light">{displayName || 'Your Name'}</p>
                    {!videoEnabled && (
                      <p className="text-muted small">
                        <i className="bi bi-camera-video-off me-1"></i>
                        Camera is off
                      </p>
                    )}
                  </div>
                )}

                {/* Controls Overlay */}
                <div className="position-absolute bottom-0 start-0 end-0 p-3 d-flex justify-content-center gap-2">
                  <button
                    className={`btn btn-lg rounded-circle ${audioEnabled ? 'btn-secondary' : 'btn-danger'}`}
                    onClick={toggleAudio}
                    style={{ width: '56px', height: '56px' }}
                    title={audioEnabled ? 'Mute' : 'Unmute'}
                  >
                    <i className={`bi ${audioEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`}></i>
                  </button>
                  <button
                    className={`btn btn-lg rounded-circle ${videoEnabled ? 'btn-secondary' : 'btn-danger'}`}
                    onClick={toggleVideo}
                    style={{ width: '56px', height: '56px' }}
                    title={videoEnabled ? 'Stop video' : 'Start video'}
                  >
                    <i className={`bi ${videoEnabled ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`}></i>
                  </button>
                </div>

                {/* Audio Level Indicator */}
                {audioEnabled && hasAudioPermission && (
                  <div className="position-absolute top-0 end-0 m-3">
                    <div className="d-flex align-items-center gap-2 bg-dark bg-opacity-75 rounded px-3 py-2">
                      <i className="bi bi-mic-fill text-success"></i>
                      <div className="progress" style={{ width: '60px', height: '8px' }}>
                        <div
                          className="progress-bar bg-success"
                          style={{ width: `${audioLevel}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Device Selection */}
              {(audioDevices.length > 1 || videoDevices.length > 1) && (
                <div className="mt-3">
                  <div className="accordion accordion-flush" id="deviceSettings">
                    <div className="accordion-item bg-dark border-secondary">
                      <h2 className="accordion-header">
                        <button
                          className="accordion-button collapsed bg-dark text-light"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target="#deviceList"
                        >
                          <i className="bi bi-gear me-2"></i>
                          Device Settings
                        </button>
                      </h2>
                      <div id="deviceList" className="accordion-collapse collapse" data-bs-parent="#deviceSettings">
                        <div className="accordion-body">
                          {audioDevices.length > 0 && (
                            <div className="mb-3">
                              <label className="form-label small text-secondary">Microphone</label>
                              <select
                                className="form-select form-select-sm bg-dark text-light border-secondary"
                                value={selectedAudioDevice}
                                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                              >
                                {audioDevices.map(device => (
                                  <option key={device.deviceId} value={device.deviceId}>
                                    {device.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {videoDevices.length > 0 && (
                            <div>
                              <label className="form-label small text-secondary">Camera</label>
                              <select
                                className="form-select form-select-sm bg-dark text-light border-secondary"
                                value={selectedVideoDevice}
                                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                              >
                                {videoDevices.map(device => (
                                  <option key={device.deviceId} value={device.deviceId}>
                                    {device.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {deviceError && (
                <div className="alert alert-warning mt-3 mb-0" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {deviceError}
                </div>
              )}
            </div>

            {/* Right Column - Join Form */}
            <div className="col-md-5">
              <div className="d-flex flex-column h-100">
                <div className="mb-4">
                  <label htmlFor="displayName" className="form-label">
                    <i className="bi bi-person-fill me-2"></i>
                    Your Name
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-dark text-light border-secondary"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={50}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                    autoFocus
                  />
                  <small className="text-secondary">This is how others will see you</small>
                </div>

                <div className="mb-4">
                  <label htmlFor="passcode" className="form-label">
                    <i className="bi bi-lock-fill me-2"></i>
                    Room Passcode
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg bg-dark text-light border-secondary"
                    id="passcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    maxLength={20}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  />
                </div>

                {/* Join Button */}
                <div className="mt-auto">
                  <button
                    className="btn btn-primary btn-lg w-100 mb-3"
                    onClick={handleJoinRoom}
                    disabled={isJoining || !displayName.trim() || !passcode.trim()}
                  >
                    {isJoining ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Joining...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Join Meeting
                      </>
                    )}
                  </button>

                  <a href="/" className="btn btn-outline-secondary w-100">
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Home
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
