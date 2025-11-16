import { useEffect, useRef } from 'react';

// Screen reader announcement utility
export const useAnnouncer = () => {
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create announcer element if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
      }
    };
  }, []);

  const announce = (message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
      // Clear after announcement to avoid repetition
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  return { announce };
};

// Focus management utility
export const useFocusManagement = () => {
  const focusableElements = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(focusableElements)) as HTMLElement[];
  };

  const trapFocus = (container: HTMLElement, currentElement: HTMLElement, shiftKey: boolean) => {
    const focusableElements = getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(currentElement);
    
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (shiftKey) {
      nextIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1;
    }

    focusableElements[nextIndex]?.focus();
  };

  return { getFocusableElements, trapFocus };
};

// Keyboard navigation utility
export const useKeyboardNavigation = () => {
  const handleKeyNavigation = (event: React.KeyboardEvent, actionMap: Record<string, () => void>) => {
    const key = event.key.toLowerCase();
    if (actionMap[key]) {
      event.preventDefault();
      actionMap[key]();
    }
  };

  return { handleKeyNavigation };
};

// ARIA live region utility for dynamic content
export const useLiveRegion = (regionId: string, politeness: 'polite' | 'assertive' = 'polite') => {
  const announceToRegion = (message: string) => {
    const region = document.getElementById(regionId);
    if (region) {
      region.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }
  };

  return { announceToRegion };
};

// Color contrast utility
export const checkColorContrast = (foreground: string, background: string): number => {
  // Convert colors to RGB
  const getRGB = (color: string): [number, number, number] => {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
    // Handle rgb() format
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    return [0, 0, 0];
  };

  const [fR, fG, fB] = getRGB(foreground);
  const [bR, bG, bB] = getRGB(background);

  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const fL = getLuminance(fR, fG, fB);
  const bL = getLuminance(bR, bG, bB);

  // Calculate contrast ratio
  const lighter = Math.max(fL, bL);
  const darker = Math.min(fL, bL);
  return (lighter + 0.05) / (darker + 0.05);
};

// Meeting-specific accessibility utilities
export const announceMeetingState = (announcer: { announce: (message: string) => void }, state: string, details?: string) => {
  const messages: Record<string, string> = {
    'connected': 'You have joined the meeting',
    'disconnected': 'You have left the meeting',
    'muted': 'Your microphone is now muted',
    'unmuted': 'Your microphone is now unmuted',
    'video-off': 'Your camera is now off',
    'video-on': 'Your camera is now on',
    'participant-joined': details ? `${details} joined the meeting` : 'A participant joined the meeting',
    'participant-left': details ? `${details} left the meeting` : 'A participant left the meeting',
    'screen-share-started': 'Screen sharing started',
    'screen-share-stopped': 'Screen sharing stopped',
    'recording-started': 'Recording started',
    'recording-stopped': 'Recording stopped',
  };

  const message = messages[state] || state;
  announcer.announce(message);
};

// Focus trap utility for modals
export const useFocusTrap = (isActive: boolean, containerRef: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive, containerRef]);
};

// Skip link utility
export const createSkipLink = (targetId: string, linkText: string = 'Skip to main content') => {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = linkText;
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 1000;
    transition: top 0.3s;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  return skipLink;
};