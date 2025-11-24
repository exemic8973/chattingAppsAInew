const testNewFullNameSignup = async () => {
  const testCases = [
    {
      name: "Signup with fullName (new email)",
      data: {
        email: "newuser1@example.com",
        password: "test12",
        fullName: "Alice Johnson",
        confirmPassword: "test12"
      }
    },
    {
      name: "Signup with fullName (another new email)",
      data: {
        email: "bob.smith@example.com",
        password: "password123",
        fullName: "Bob Smith",
        confirmPassword: "password123"
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
      
      if (response.status === 422) {
        const errorData = await response.json();
        console.log('❌ Validation Errors:', JSON.stringify(errorData.error?.details || errorData, null, 2));
      } else if (response.status === 500) {
        const errorData = await response.json();
        console.log('⚠️ Server Error:', JSON.stringify(errorData, null, 2));
      } else {
        const responseData = await response.json();
        console.log('✅ Response:', JSON.stringify(responseData, null, 2));
        
        if (response.status === 200) {
          console.log('🎉 SIGNUP SUCCESSFUL with fullName after restart!');
          console.log('Token:', responseData.data.token);
          console.log('User:', responseData.data.user);
        }
      }
      
    } catch (error) {
      console.log('Network error:', error.message);
    }
  }
};

testNewFullNameSignup();