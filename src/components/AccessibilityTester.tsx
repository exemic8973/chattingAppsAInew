import React, { useState, useEffect, useCallback } from 'react';
import { checkColorContrast } from '@/lib/accessibility';

interface AccessibilityIssue {
  type: 'contrast' | 'missing-label' | 'keyboard' | 'aria' | 'semantic';
  element: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

interface AccessibilityTesterProps {
  isEnabled?: boolean;
  onIssueFound?: (issues: AccessibilityIssue[]) => void;
  className?: string;
}

export default function AccessibilityTester({ 
  isEnabled = process.env.NODE_ENV === 'development', 
  onIssueFound,
  className 
}: AccessibilityTesterProps) {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const scanForIssues = useCallback(() => {
    if (!isEnabled) return;

    setIsScanning(true);
    const foundIssues: AccessibilityIssue[] = [];

    // Check color contrast
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button, index) => {
      const computedStyle = window.getComputedStyle(button);
      const backgroundColor = computedStyle.backgroundColor;
      const color = computedStyle.color;
      
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && color) {
        const contrastRatio = checkColorContrast(color, backgroundColor);
        if (contrastRatio < 4.5) { // WCAG AA standard
          foundIssues.push({
            type: 'contrast',
            element: `Button ${index + 1}`,
            message: `Low contrast ratio: ${contrastRatio.toFixed(2)}:1`,
            severity: 'error',
            suggestion: 'Increase contrast to at least 4.5:1 for WCAG AA compliance'
          });
        } else if (contrastRatio < 7) {
          foundIssues.push({
            type: 'contrast',
            element: `Button ${index + 1}`,
            message: `Contrast ratio could be improved: ${contrastRatio.toFixed(2)}:1`,
            severity: 'warning',
            suggestion: 'Consider increasing contrast to 7:1 for WCAG AAA compliance'
          });
        }
      }
    });

    // Check for missing ARIA labels
    const interactiveElements = document.querySelectorAll('button, input, select, textarea, a[href]');
    interactiveElements.forEach((element, index) => {
      const tagName = element.tagName.toLowerCase();
      
      // Check for aria-label or aria-labelledby
      if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
        // Check if it has accessible text content
        const textContent = element.textContent?.trim() || '';
        const hasAccessibleText = textContent.length > 0;
        
        if (!hasAccessibleText) {
          foundIssues.push({
            type: 'missing-label',
            element: `${tagName} ${index + 1}`,
            message: 'Interactive element lacks accessible label',
            severity: 'error',
            suggestion: 'Add aria-label attribute or ensure element has text content'
          });
        }
      }

      // Check for proper ARIA roles
      if (element.getAttribute('role') === 'button' && tagName !== 'button') {
        foundIssues.push({
          type: 'semantic',
          element: `${tagName} ${index + 1}`,
          message: 'Using role="button" on non-button element',
          severity: 'warning',
          suggestion: 'Consider using native button element instead'
        });
      }
    });

    // Check for keyboard navigation issues
    const focusableElements = document.querySelectorAll('[tabindex]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
    let previousTabIndex = -1;
    focusableElements.forEach((element, index) => {
      const tabIndex = parseInt(element.getAttribute('tabindex') || '0');
      if (tabIndex < previousTabIndex && tabIndex >= 0) {
        foundIssues.push({
          type: 'keyboard',
          element: `Element ${index + 1}`,
          message: 'Tab order may be confusing',
          severity: 'warning',
          suggestion: 'Review tab order for logical navigation flow'
        });
      }
      previousTabIndex = tabIndex;
    });

    // Check for heading structure
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        foundIssues.push({
          type: 'semantic',
          element: `${heading.tagName} ${index + 1}`,
          message: 'Heading level skipped',
          severity: 'warning',
          suggestion: 'Maintain logical heading hierarchy'
        });
      }
      previousLevel = level;
    });

    setIssues(foundIssues);
    setIsScanning(false);
    
    if (onIssueFound) {
      onIssueFound(foundIssues);
    }
  }, [isEnabled, onIssueFound]);

  useEffect(() => {
    if (isEnabled) {
      // Initial scan
      const timer = setTimeout(scanForIssues, 1000);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, scanForIssues]);

  // Auto-scan on DOM changes
  useEffect(() => {
    if (!isEnabled) return;

    const observer = new MutationObserver(() => {
      scanForIssues();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-label', 'role']
    });

    return () => observer.disconnect();
  }, [isEnabled, scanForIssues]);

  if (!isEnabled) return null;

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <div className={`accessibility-tester ${className || ''}`} style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 10000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>♿ Accessibility Check</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: '1px solid white',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            cursor: 'pointer'
          }}
        >
          {showDetails ? 'Hide' : 'Show'}
        </button>
      </div>

      {isScanning && (
        <div style={{ textAlign: 'center', padding: '8px' }}>
          <div style={{ animation: 'spin 1s linear infinite', fontSize: '16px' }}>⟳</div>
          <div>Scanning...</div>
        </div>
      )}

      {!isScanning && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            {errorCount > 0 && (
              <span style={{ color: '#ff6b6b' }}>
                <strong>{errorCount}</strong> errors
              </span>
            )}
            {warningCount > 0 && (
              <span style={{ color: '#ffd93d' }}>
                <strong>{warningCount}</strong> warnings
              </span>
            )}
            {infoCount > 0 && (
              <span style={{ color: '#6bcf7f' }}>
                <strong>{infoCount}</strong> info
              </span>
            )}
            {issues.length === 0 && (
              <span style={{ color: '#6bcf7f' }}>
                ✓ No issues found!
              </span>
            )}
          </div>

          {showDetails && issues.length > 0 && (
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              paddingTop: '8px'
            }}>
              {issues.slice(0, 5).map((issue, index) => (
                <div key={index} style={{ 
                  marginBottom: '8px', 
                  padding: '4px',
                  background: issue.severity === 'error' ? 'rgba(255,107,107,0.1)' :
                             issue.severity === 'warning' ? 'rgba(255,217,61,0.1)' :
                             'rgba(107,207,127,0.1)',
                  borderRadius: '4px'
                }}>
                  <div style={{ 
                    fontWeight: 'bold',
                    color: issue.severity === 'error' ? '#ff6b6b' :
                           issue.severity === 'warning' ? '#ffd93d' :
                           '#6bcf7f'
                  }}>
                    {issue.type.toUpperCase()}: {issue.element}
                  </div>
                  <div style={{ margin: '2px 0' }}>{issue.message}</div>
                  {issue.suggestion && (
                    <div style={{ 
                      fontSize: '10px', 
                      opacity: 0.8,
                      fontStyle: 'italic'
                    }}>
                      💡 {issue.suggestion}
                    </div>
                  )}
                </div>
              ))}
              {issues.length > 5 && (
                <div style={{ textAlign: 'center', opacity: 0.7, fontSize: '10px' }}>
                  ...and {issues.length - 5} more issues
                </div>
              )}
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '8px',
            fontSize: '10px'
          }}>
            <button
              onClick={scanForIssues}
              disabled={isScanning}
              style={{
                background: '#007bff',
                border: 'none',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: isScanning ? 'not-allowed' : 'pointer',
                opacity: isScanning ? 0.6 : 1
              }}
            >
              {isScanning ? 'Scanning...' : 'Re-scan'}
            </button>
            
            <div style={{ 
              padding: '4px 8px', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>WCAG 2.1 AA</span>
              <span style={{ opacity: 0.7 }}>•</span>
              <span>Real-time</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}