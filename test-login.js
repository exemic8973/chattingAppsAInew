async function testLogin() {
  console.log('🔐 Testing login functionality...\n');
  
  const loginData = {
    email: "browsertest2@example.com",
    password: "test12"
  };
  
  console.log('Testing login with:');
  console.log(JSON.stringify(loginData, null, 2));
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('Token:', data.data.token.substring(0, 20) + '...');
      console.log('User data:', data.data.user);
      console.log('Full response:', data);
    } else {
      const errorData = await response.json();
      console.log('❌ Login failed');
      console.log('Error:', errorData);
      if (errorData.error?.details) {
        console.log('Validation errors:', JSON.stringify(errorData.error.details, null, 2));
      }
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testLogin();