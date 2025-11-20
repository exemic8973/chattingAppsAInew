const debugSignup = async () => {
  const testPayload = {
    email: "debug@example.com",
    password: "test12",
    userName: "debuguser",
    confirmPassword: "test12"
  };

  console.log('🧪 Testing signup with payload:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n📤 Making request to http://localhost:3000/api/auth/signup...');
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    console.log('📋 Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    const responseText = await response.text();
    console.log('\n📄 Raw Response Body:');
    console.log(responseText);
    
    try {
      const responseData = JSON.parse(responseText);
      console.log('\n🎯 Parsed Response:');
      console.log(JSON.stringify(responseData, null, 2));
      
      if (response.status === 422 && responseData.error?.details) {
        console.log('\n❌ Validation Errors:');
        Object.entries(responseData.error.details).forEach(([field, errors]) => {
          console.log(`  ${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`);
        });
      }
    } catch (e) {
      console.log('\n⚠️ Could not parse JSON response');
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
};

debugSignup();