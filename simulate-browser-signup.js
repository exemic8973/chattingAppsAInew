const simulateBrowserSignup = async () => {
  console.log('🌐 Simulating exact browser signup request...\n');
  
  // Simulate the exact values that might be in the form fields
  const simulatedFormData = {
    email: "browseruser@example.com",  // Fresh email to avoid conflicts
    password: "test12",
    fullName: "Browser User",
    confirmPassword: "test12"
  };
  
  console.log('📋 Simulated form data:');
  console.log(JSON.stringify(simulatedFormData, null, 2));
  
  // Test with the exact same request structure as the browser
  console.log('\n🚀 Making browser-style request...');
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add browser-like headers
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(simulatedFormData),
      // Add browser-like options
      mode: 'cors',
      credentials: 'same-origin'
    });
    
    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 422) {
      console.log('\n❌ 422 Error Detected!');
      const errorText = await response.text();
      console.log('Error response:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.log('\n🔍 Detailed Error Analysis:');
        console.log('Error message:', errorData.message);
        console.log('Error code:', errorData.error?.code);
        console.log('Error details:', JSON.stringify(errorData.error?.details, null, 2));
      } catch (e) {
        console.log('Raw error text:', errorText);
      }
    } else if (response.ok) {
      console.log('\n✅ Request successful!');
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log(`\n⚠️ Unexpected status: ${response.status}`);
      const text = await response.text();
      console.log('Response:', text);
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
};

simulateBrowserSignup();