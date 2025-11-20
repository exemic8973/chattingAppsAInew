const testFixedSignup = async () => {
  const testCases = [
    {
      name: "Simple password (6+ chars) - should work now",
      data: {
        email: "test@example.com",
        password: "test12",
        userName: "testuser",
        confirmPassword: "test12"
      }
    },
    {
      name: "Very simple credentials - development mode",
      data: {
        email: "simple@example.com",
        password: "123456",
        userName: "simple",
        confirmPassword: "123456"
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
      
      if (response.status === 200) {
        console.log('✅ SIGNUP SUCCESSFUL!');
        console.log('Token:', responseData.data.token);
        console.log('User:', responseData.data.user);
      }
      
    } catch (error) {
      console.log('Network error:', error.message);
    }
  }
};

testFixedSignup();