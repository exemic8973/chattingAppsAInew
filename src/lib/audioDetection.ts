/**
 * Audio detection utilities for detecting when someone is speaking
 */

/**
 * Detects when someone is speaking by analyzing audio levels
 * @param stream - MediaStream to analyze
 * @param callback - Function to call when speaking status changes
 * @returns Cleanup function to stop detection
 */
export function detectSpeaking(stream: MediaStream, callback: (isSpeaking: boolean) => void): () => void {
  if (!stream.getAudioTracks().length) {
    console.log('🎤 No audio tracks in stream, skipping speaking detection');
    return () => {}; // Return empty cleanup function
  }

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    microphone.connect(analyser);

    let isSpeaking = false;
    let speakingTimeout: NodeJS.Timeout | null = null;
    const SPEAKING_THRESHOLD = 30; // Audio level threshold
    const SPEAKING_TIMEOUT = 1000; // Stop speaking after 1 second of silence

    const checkSpeaking = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      const wasSpeaking = isSpeaking;
      
      if (average > SPEAKING_THRESHOLD) {
        // Person is speaking
        isSpeaking = true;
        
        // Clear any existing timeout
        if (speakingTimeout) {
          clearTimeout(speakingTimeout);
          speakingTimeout = null;
        }
        
        if (!wasSpeaking) {
          console.log('🗣️ Speaking detected');
          callback(true);
        }
      } else {
        // Person might have stopped speaking - set a timeout
        if (isSpeaking && !speakingTimeout) {
          speakingTimeout = setTimeout(() => {
            isSpeaking = false;
            speakingTimeout = null;
            console.log('🔇 Speaking stopped');
            callback(false);
          }, SPEAKING_TIMEOUT);
        }
      }
    };

    // Check every 100ms
    const interval = setInterval(checkSpeaking, 100);

    // Return cleanup function
    return () => {
      console.log('🎤 Cleaning up speaking detection');
      clearInterval(interval);
      if (speakingTimeout) {
        clearTimeout(speakingTimeout);
      }
      try {
        microphone.disconnect();
        audioContext.close();
      } catch (error) {
        console.warn('Error cleaning up audio context:', error);
      }
    };
  } catch (error) {
    console.error('❌ Error setting up speaking detection:', error);
    return () => {}; // Return empty cleanup function on error
  }
}