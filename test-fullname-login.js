const testFullNameLogin = async () => {
  const testCases = [
    {
      name: "Login with user created using fullName",
      data: {
        email: "john.doe@example.com",
        password: "test12"
      }
    },
    {
      name: "Login with user created using complex fullName",
      data: {
        email: "mary.jane.smith@example.com",
        password: "password123"
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
      
      if (response.status === 422) {
        const errorData = await response.json();
        console.log('❌ Validation Errors:', JSON.stringify(errorData.error?.details || errorData, null, 2));
      } else {
        const responseData = await response.json();
        console.log('✅ Response:', JSON.stringify(responseData, null, 2));
        
        if (response.status === 200) {
          console.log('🎉 LOGIN SUCCESSFUL with fullName user!');
          console.log('Token:', responseData.data.token);
          console.log('User:', responseData.data.user);
        }
      }
      
    } catch (error) {
      console.log('Network error:', error.message);
    }
  }
};

testFullNameLogin();