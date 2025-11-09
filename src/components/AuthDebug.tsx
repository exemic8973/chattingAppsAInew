'use client';

import { useEffect } from 'react';

export default function AuthDebug() {
  useEffect(() => {
    // Test the authentication endpoint
    const testAuth = async () => {
      try {
        console.log('🧪 Testing authentication endpoint...');
        
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'test123',
          }),
        });

        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        
        const text = await response.text();
        console.log('📡 Response text:', text);
        
        try {
          const data = JSON.parse(text);
          console.log('✅ JSON parsed successfully:', data);
        } catch (parseError) {
          console.log('❌ JSON parse error:', parseError);
          console.log('📄 Response is HTML, not JSON:', text.substring(0, 200));
        }
      } catch (error) {
        console.error('❌ Network error:', error);
      }
    };

    testAuth();
  }, []);

  return (
    <div className="fixed-top p-3 bg-warning text-dark" style={{ zIndex: 9999 }}>
      <small>
        🔍 Auth Debug: Check browser console for authentication endpoint test results
      </small>
    </div>
  );
}