const debugFrontendSignup = async () => {
  console.log('🔍 Debugging frontend signup 422 error...\n');
  
  // Test the exact same payload that the frontend would send
  const frontendPayload = {
    email: "testuser@example.com",
    password: "test12",
    fullName: "Test User",
    confirmPassword: "test12"
  };
  
  console.log('📤 Testing payload that frontend sends:');
  console.log(JSON.stringify(frontendPayload, null, 2));
  console.log('\n🌐 Making request to /api/auth/signup...');
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(frontendPayload)
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    console.log('📋 Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    const responseText = await response.text();
    console.log('\n📄 Raw Response Body:');
    console.log(responseText);
    
    if (response.status === 422) {
      console.log('\n❌ 422 Validation Error Details:');
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error?.details) {
          console.log('Validation errors:', JSON.stringify(errorData.error.details, null, 2));
        } else {
          console.log('Full error response:', JSON.stringify(errorData, null, 2));
        }
      } catch (e) {
        console.log('Could not parse error response:', responseText);
      }
    } else if (response.ok) {
      console.log('\n✅ Signup successful!');
      const data = JSON.parse(responseText);
      console.log('Response data:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
  
  console.log('\n🔍 Analysis:');
  console.log('If this test works but the frontend gets 422, there might be a difference in:');
  console.log('1. Request headers');
  console.log('2. Payload structure');
  console.log('3. Content-Type');
  console.log('4. Browser-specific issues');
};

debugFrontendSignup();