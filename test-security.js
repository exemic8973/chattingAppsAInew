const axios = require('axios');
const io = require('socket.io-client');

class SecurityTestSuite {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async runTests() {
    console.log('🔒 Starting Security Test Suite\n');
    console.log('='.repeat(50));

    try {
      await this.testCORS();
      await this.testRateLimiting();
      await this.testSecurityHeaders();
      await this.testInputValidation();
      await this.testSocketSecurity();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  addTestResult(testName, passed, details = '') {
    const result = {
      testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    if (passed) {
      this.passedTests++;
      console.log(`✅ ${testName}`);
    } else {
      this.failedTests++;
      console.log(`❌ ${testName}`);
      if (details) console.log(`   ${details}`);
    }
  }

  async testCORS() {
    console.log('\n🌐 Testing CORS Configuration');
    console.log('-'.repeat(50));

    try {
      // Test CORS headers are present
      const response = await axios.get(`${this.baseURL}/health`, {
        headers: { 'Origin': 'http://localhost:3000' }
      });

      const hasCorsHeaders = 
        response.headers['access-control-allow-origin'] !== undefined ||
        response.headers['Access-Control-Allow-Origin'] !== undefined;

      this.addTestResult(
        'CORS headers present',
        hasCorsHeaders,
        `Headers: ${JSON.stringify(response.headers, null, 2)}`
      );

      // Test preflight request
      const preflightResponse = await axios.options(`${this.baseURL}/health`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      this.addTestResult(
        'CORS preflight handled',
        preflightResponse.status === 204,
        `Status: ${preflightResponse.status}`
      );

    } catch (error) {
      this.addTestResult('CORS configuration', false, error.message);
    }
  }

  async testRateLimiting() {
    console.log('\n⏱️  Testing Rate Limiting');
    console.log('-'.repeat(50));

    try {
      // Make multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          axios.get(`${this.baseURL}/health`).catch(err => err.response)
        );
      }

      const responses = await Promise.all(requests);
      const hasRateLimitHeaders = responses.some(res => 
        res.headers && (
          res.headers['x-ratelimit-limit'] ||
          res.headers['X-RateLimit-Limit']
        )
      );

      this.addTestResult(
        'Rate limit headers present',
        hasRateLimitHeaders,
        'X-RateLimit headers found in responses'
      );

      // Check if rate limiting is actually working
      const rateLimitedResponse = responses.find(res => res.status === 429);
      this.addTestResult(
        'Rate limiting active',
        rateLimitedResponse !== undefined,
        rateLimitedResponse ? 'Rate limit (429) triggered' : 'Rate limit not triggered in test'
      );

    } catch (error) {
      this.addTestResult('Rate limiting', false, error.message);
    }
  }

  async testSecurityHeaders() {
    console.log('\n🛡️  Testing Security Headers');
    console.log('-'.repeat(50));

    try {
      const response = await axios.get(`${this.baseURL}/health`);
      const headers = response.headers;

      const requiredHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin-when-cross-origin'
      };

      for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
        const actualValue = headers[header] || headers[header.toLowerCase()];
        this.addTestResult(
          `Security header: ${header}`,
          actualValue === expectedValue,
          `Expected: ${expectedValue}, Got: ${actualValue || 'missing'}`
        );
      }

    } catch (error) {
      this.addTestResult('Security headers', false, error.message);
    }
  }

  async testInputValidation() {
    console.log('\n✅ Testing Input Validation');
    console.log('-'.repeat(50));

    try {
      // Test with potentially malicious input
      const maliciousInput = {
        roomId: '<script>alert("xss")</script>test-room',
        passcode: 'test123',
        userName: '<img src=x onerror=alert(1)>Hacker'
      };

      const response = await axios.post(
        `${this.baseURL}/debug/create-room`,
        maliciousInput,
        { validateStatus: () => true }
      );

      // Check if input was sanitized (no HTML tags in response)
      const responseData = JSON.stringify(response.data);
      const hasUnsanitizedInput = 
        responseData.includes('<script>') || 
        responseData.includes('<img src=x');

      this.addTestResult(
        'Input sanitization active',
        !hasUnsanitizedInput,
        hasUnsanitizedInput ? 'Malicious input not sanitized' : 'Input properly sanitized'
      );

    } catch (error) {
      this.addTestResult('Input validation', false, error.message);
    }
  }

  async testSocketSecurity() {
    console.log('\n🔌 Testing Socket.IO Security');
    console.log('-'.repeat(50));

    try {
      // Test socket connection with CORS
      const socket = io(this.baseURL, {
        transports: ['websocket'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        socket.on('connect', () => {
          this.addTestResult('Socket.IO connection', true, 'Connected successfully');
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', (error) => {
          this.addTestResult('Socket.IO connection', false, error.message);
          reject(error);
        });

        setTimeout(() => {
          this.addTestResult('Socket.IO connection', false, 'Connection timeout');
          socket.disconnect();
          resolve();
        }, 5000);
      });

    } catch (error) {
      this.addTestResult('Socket.IO security', false, error.message);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Security Test Results');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`📋 Total: ${this.testResults.length}`);
    
    const passRate = ((this.passedTests / this.testResults.length) * 100).toFixed(1);
    console.log(`📈 Pass Rate: ${passRate}%`);
    
    if (this.failedTests > 0) {
      console.log('\n⚠️  Failed Tests:');
      this.testResults
        .filter(result => !result.passed)
        .forEach(result => {
          console.log(`   ❌ ${result.testName}`);
          if (result.details) console.log(`      ${result.details}`);
        });
    }

    console.log('\n🔒 Security implementation is ' + 
      (passRate >= 80 ? '✅ STRONG' : passRate >= 60 ? '⚠️  MODERATE' : '❌ WEAK')
    );
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new SecurityTestSuite();
  testSuite.runTests().catch(console.error);
}

module.exports = SecurityTestSuite;