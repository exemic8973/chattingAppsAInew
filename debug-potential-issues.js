const debugPotentialIssues = async () => {
  console.log('🔍 Debugging potential causes of frontend 422 error...\n');
  
  // Test 1: Check if there might be validation issues we missed
  console.log('1️⃣ Testing various edge cases that might cause 422:');
  
  const testCases = [
    {
      name: "Empty fullName",
      data: { email: "empty@example.com", password: "test12", fullName: "", confirmPassword: "test12" }
    },
    {
      name: "Single character fullName",
      data: { email: "single@example.com", password: "test12", fullName: "A", confirmPassword: "test12" }
    },
    {
      name: "Numbers in fullName (should fail)",
      data: { email: "numbers@example.com", password: "test12", fullName: "John123", confirmPassword: "test12" }
    },
    {
      name: "Special chars in fullName (should fail)",
      data: { email: "special@example.com", password: "test12", fullName: "John@Doe", confirmPassword: "test12" }
    },
    {
      name: "Very long fullName",
      data: { email: "long@example.com", password: "test12", fullName: "A".repeat(60), confirmPassword: "test12" }
    },
    {
      name: "Whitespace-only fullName",
      data: { email: "whitespace@example.com", password: "test12", fullName: "   ", confirmPassword: "test12" }
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
      
      console.log(`Status: ${response.status}`);
      
      if (response.status === 422) {
        const errorData = await response.json();
        console.log('❌ Validation errors:', JSON.stringify(errorData.error?.details, null, 2));
      } else if (response.ok) {
        console.log('✅ Success - this case works');
      } else {
        console.log('⚠️ Other error:', response.status);
      }
      
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }
  }
  
  console.log('\n2️⃣ Checking if there might be a field name mismatch:');
  
  // Test with different field name variations
  const fieldNameTests = [
    {
      name: "Using 'name' instead of 'fullName'",
      data: { email: "namefield@example.com", password: "test12", name: "Test User", confirmPassword: "test12" }
    },
    {
      name: "Using 'userName' instead of 'fullName'",
      data: { email: "usernamefield@example.com", password: "test12", userName: "Test User", confirmPassword: "test12" }
    },
    {
      name: "Using 'full_name' instead of 'fullName'",
      data: { email: "underscore@example.com", password: "test12", full_name: "Test User", confirmPassword: "test12" }
    }
  ];
  
  for (const testCase of fieldNameTests) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data)
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.status === 422) {
        const errorData = await response.json();
        console.log('❌ Validation errors:', JSON.stringify(errorData.error?.details, null, 2));
      }
      
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }
  }
  
  console.log('\n3️⃣ Testing with a guaranteed working payload:');
  
  const workingPayload = {
    email: "guaranteed@example.com",
    password: "test12",
    fullName: "John Doe",
    confirmPassword: "test12"
  };
  
  console.log('Working payload:', JSON.stringify(workingPayload, null, 2));
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workingPayload)
    });
    
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      console.log('✅ Guaranteed working payload succeeds');
    } else {
      console.log('❌ Even guaranteed payload fails - this is unexpected!');
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
};

debugPotentialIssues();