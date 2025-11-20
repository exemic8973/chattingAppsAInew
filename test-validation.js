const testSignup = async () => {
  const testCases = [
    {
      name: "Weak password (missing uppercase, number, special char)",
      data: {
        email: "test@example.com",
        password: "test123",
        userName: "testuser",
        confirmPassword: "test123"
      }
    },
    {
      name: "Valid password (meets all requirements)",
      data: {
        email: "test@example.com", 
        password: "Test123!",
        userName: "testuser",
        confirmPassword: "Test123!"
      }
    },
    {
      name: "Missing confirmPassword",
      data: {
        email: "test@example.com",
        password: "Test123!",
        userName: "testuser"
      }
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
      const responseData = await response.json();
      console.log('Response:', JSON.stringify(responseData, null, 2));
      
    } catch (error) {
      console.log('Network error:', error.message);
    }
  }
};

testSignup();