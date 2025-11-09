import { v4 as uuidv4 } from 'uuid';

export const generateRoomId = (): string => {
  // Generate a shorter, more readable room ID
  const adjectives = ['RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'PURPLE', 'ORANGE', 'PINK'];
  const nouns = ['STAR', 'MOON', 'SUN', 'SKY', 'WAVE', 'FIRE', 'ICE', 'WIND'];
  const numbers = Math.floor(100 + Math.random() * 900);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}-${noun}-${numbers}`;
};

export const generatePasscode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateShareUrl = (roomId: string): string => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/room/${roomId}`;
};

export const formatTime = (date: Date): string => {
  if (!date) {
    return '';
  }
  
  // Convert to Date if it's a string or timestamp
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback: Use document.execCommand for older browsers or non-HTTPS
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          console.log('✅ Text copied using fallback method');
          return true;
        } else {
          console.warn('❌ Fallback copy method failed');
          return false;
        }
      } catch (err) {
        document.body.removeChild(textArea);
        console.error('❌ Fallback copy method error:', err);
        return false;
      }
    }
  } catch (err) {
    console.error('❌ Failed to copy text:', err);
    return false;
  }
};