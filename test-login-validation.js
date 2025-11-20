const testLogin = async () => {
  const testCases = [
    {
      name: "Valid login credentials",
      data: {
        email: "test@example.com",
        password: "Test123!"
      }
    },
    {
      name: "Invalid email format",
      data: {
        email: "invalid-email",
        password: "Test123!"
      }
    },
    {
      name: "Missing password",
      data: {
        email: "test@example.com"
      }
    },
    {
      name: "Empty credentials",
      data: {}
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('Data:', JSON.stringify(testCase.data, null, 2));
    
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
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

testLogin();