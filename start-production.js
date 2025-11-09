const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting production servers...');

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

// Verify JWT_SECRET is set
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET is not set! Using default secret (NOT SECURE FOR PRODUCTION)');
  process.env.JWT_SECRET = 'your-secret-key-change-in-production';
} else {
  console.log('✅ JWT_SECRET is configured');
}

console.log('🔑 Environment variables:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('  - PORT:', process.env.PORT || 'default (3000)');

// Start backend server (Socket.IO on port 3001)
console.log('📡 Starting backend server on port 3001...');
const backend = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '3001',
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
  }
});

backend.on('error', (error) => {
  console.error('❌ Backend server error:', error);
  process.exit(1);
});

backend.on('exit', (code) => {
  console.log(`⚠️ Backend server exited with code ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Wait a bit for backend to start, then start frontend
setTimeout(() => {
  console.log('🌐 Starting frontend server...');
  const frontend = spawn('npx', ['next', 'start', '-p', process.env.PORT || '3000'], {
    stdio: 'inherit',
    env: process.env,
    shell: true
  });

  frontend.on('error', (error) => {
    console.error('❌ Frontend server error:', error);
    backend.kill();
    process.exit(1);
  });

  frontend.on('exit', (code) => {
    console.log(`⚠️ Frontend server exited with code ${code}`);
    backend.kill();
    process.exit(code);
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received, shutting down...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('⚠️ SIGINT received, shutting down...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}, 2000); // Give backend 2 seconds to start

console.log('✅ Production servers starting...');
