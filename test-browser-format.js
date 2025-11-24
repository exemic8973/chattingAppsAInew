async function testBrowserFormat() {
  console.log('🧪 Testing exact browser format...\n');
  
  const testData = {
    email: "browsertest2@example.com",
    password: "test12",
    fullName: "Browser Test User",
    confirmPassword: "test12"
  };
  
  console.log('Testing with exact format:');
  console.log(JSON.stringify(testData, null, 2));
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('\nResponse status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS!');
      console.log('Response:', data);
    } else {
      const errorData = await response.json();
      console.log('❌ FAILED');
      console.log('Error:', errorData);
      if (errorData.error?.details) {
        console.log('Validation errors:', JSON.stringify(errorData.error.details, null, 2));
      }
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testBrowserFormat();