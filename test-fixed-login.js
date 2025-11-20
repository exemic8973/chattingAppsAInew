const testFixedLogin = async () => {
  const testCases = [
    {
      name: "Login with newly created user (simple password)",
      data: {
        email: "newuser@example.com",
        password: "test12"
      }
    },
    {
      name: "Login with newly created user (very simple password)",
      data: {
        email: "simple2@example.com",
        password: "123456"
      }
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
      
      if (response.status === 200) {
        console.log('✅ LOGIN SUCCESSFUL!');
        console.log('Token:', responseData.data.token);
        console.log('User:', responseData.data.user);
      }
      
    } catch (error) {
      console.log('Network error:', error.message);
    }
  }
};

testFixedLogin();