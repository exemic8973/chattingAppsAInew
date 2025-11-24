const testVariousScenarios = async () => {
  const testCases = [
    {
      name: "Valid request (should work)",
      data: {
        email: "valid@example.com",
        password: "test12",
        userName: "validuser",
        confirmPassword: "test12"
      },
      expectedStatus: 200
    },
    {
      name: "Password too short (should fail)",
      data: {
        email: "short@example.com",
        password: "123",  // Only 3 chars - should fail
        userName: "shortuser",
        confirmPassword: "123"
      },
      expectedStatus: 422
    },
    {
      name: "Missing confirmPassword (should fail)",
      data: {
        email: "missing@example.com",
        password: "test12",
        userName: "missinguser"
        // Missing confirmPassword
      },
      expectedStatus: 422
    },
    {
      name: "Invalid email format (should fail)",
      data: {
        email: "invalid-email",  // No @ symbol
        password: "test12",
        userName: "invaliduser",
        confirmPassword: "test12"
      },
      expectedStatus: 422
    },
    {
      name: "Passwords don't match (should fail)",
      data: {
        email: "mismatch@example.com",
        password: "test12",
        userName: "mismatchuser",
        confirmPassword: "different"  // Doesn't match password
      },
      expectedStatus: 422
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('Data:', JSON.stringify(testCase.data, null, 2));
    
    try {
      const response = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data)
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 422) {
        const errorData = await response.json();
        console.log('❌ Validation Errors:', JSON.stringify(errorData.error?.details || errorData, null, 2));
      } else {
        const responseData = await response.json();
        console.log('✅ Response:', JSON.stringify(responseData, null, 2));
      }
      
    } catch (error) {
      console.log('Network error:', error.message);
    }
  }
};

testVariousScenarios();