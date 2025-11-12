'use client';

import { useEffect, useState } from 'react';

export default function DebugPage() {
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  useEffect(() => {
    addResult('Page loaded');
    addResult(`Protocol: ${window.location.protocol}`);
    addResult(`Host: ${window.location.host}`);
    addResult(`User Agent: ${navigator.userAgent}`);

    // Test HTTPS fetch
    fetch(window.location.origin + '/api/health')
      .then(res => {
        addResult(`✅ HTTPS API fetch successful: ${res.status}`);
        return res.json();
      })
      .then(data => {
        addResult(`API Response: ${JSON.stringify(data)}`);
      })
      .catch(err => {
        addResult(`❌ HTTPS API fetch failed: ${err.message}`);
      });

    // Test WebSocket
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      addResult(`Attempting WebSocket connection to: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        addResult('✅ WebSocket connection opened');
        ws.close();
      };

      ws.onerror = (error) => {
        addResult(`❌ WebSocket error: ${error}`);
      };

      ws.onclose = () => {
        addResult('WebSocket connection closed');
      };
    } catch (err: any) {
      addResult(`❌ WebSocket creation failed: ${err.message}`);
    }
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>Connection Debug Page</h1>
      <p>Share this page output to help diagnose SSL/connection issues</p>

      <div style={{
        background: '#f0f0f0',
        padding: '10px',
        borderRadius: '5px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {results.map((result, idx) => (
          <div key={idx} style={{
            marginBottom: '5px',
            color: result.includes('❌') ? 'red' : result.includes('✅') ? 'green' : 'black'
          }}>
            {result}
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          const text = results.join('\n');
          navigator.clipboard.writeText(text);
          alert('Debug info copied to clipboard!');
        }}
        style={{
          marginTop: '10px',
          padding: '10px 20px',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Copy Debug Info
      </button>
    </div>
  );
}
