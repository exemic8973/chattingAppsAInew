// Browser debugging tool - place this in browser console or use as reference
console.log('🔍 Browser Debugging Tool for Signup Issues');

// Function to intercept and log form data before submission
function debugSignupForm() {
  console.log('📝 Debugging signup form data...');
  
  // Find the signup form
  const form = document.querySelector('form[action*="signup"], form[onsubmit*="signup"], #signupForm') || 
               document.querySelector('form');
  
  if (form) {
    console.log('✅ Found form:', form);
    
    // Add form submission interceptor
    form.addEventListener('submit', function(e) {
      console.log('🚀 Form submission intercepted!');
      
      // Get all form data
      const formData = new FormData(form);
      const data = {};
      for (let [key, value] of formData.entries()) {
        data[key] = value;
      }
      
      console.log('📋 Form data being sent:');
      console.log(JSON.stringify(data, null, 2));
      
      // Check for common issues
      const issues = [];
      
      if (!data.fullName) {
        issues.push('❌ fullName field is missing or empty');
      } else if (data.fullName.length < 2) {
        issues.push('❌ fullName too short (minimum 2 characters)');
      } else if (data.fullName.length > 50) {
        issues.push('❌ fullName too long (maximum 50 characters)');
      } else if (!/^[a-zA-Z\s\-\']+$/.test(data.fullName)) {
        issues.push('❌ fullName contains invalid characters (only letters, spaces, hyphens, apostrophes allowed)');
      }
      
      if (!data.email || !data.email.includes('@')) {
        issues.push('❌ Invalid email format');
      }
      
      if (!data.password || data.password.length < 6) {
        issues.push('❌ Password too short (minimum 6 characters)');
      }
      
      if (data.password !== data.confirmPassword) {
        issues.push('❌ Passwords do not match');
      }
      
      if (issues.length > 0) {
        console.log('⚠️ Validation issues found:');
        issues.forEach(issue => console.log(issue));
        alert('Form validation issues:\n' + issues.join('\n'));
      } else {
        console.log('✅ Form data looks valid');
      }
      
      // Continue with form submission
      // The browser will still submit, but now you can see what was sent
    }, true); // Use capture phase
    
    // Also intercept the fetch/XMLHttpRequest
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      console.log('🌐 Fetch request intercepted:', args[0]);
      if (args[0] && args[0].includes && args[0].includes('/api/auth/signup')) {
        console.log('📤 Signup API request detected!');
        console.log('Method:', args[1]?.method);
        console.log('Headers:', args[1]?.headers);
        console.log('Body:', args[1]?.body);
        
        if (args[1]?.body) {
          try {
            const bodyData = JSON.parse(args[1].body);
            console.log('📋 Request body data:');
            console.log(JSON.stringify(bodyData, null, 2));
          } catch (e) {
            console.log('Raw body:', args[1].body);
          }
        }
      }
      return originalFetch.apply(this, args);
    };
    
    console.log('✅ Debugging hooks installed!');
    console.log('📝 Now fill out the form and submit to see what data is being sent.');
    
  } else {
    console.log('❌ Could not find signup form');
    console.log('Available forms:', document.querySelectorAll('form'));
  }
}

// Run the debugging function
debugSignupForm();

// Additional debugging - check current page state
console.log('📍 Current page analysis:');
console.log('URL:', window.location.href);
console.log('Available inputs:', document.querySelectorAll('input'));

// Manual testing function
window.testManualSignup = function(email, password, fullName, confirmPassword) {
  console.log('🧪 Manual signup test');
  const payload = {
    email: email || 'manualtest@example.com',
    password: password || 'test12',
    fullName: fullName || 'Manual Test User',
    confirmPassword: confirmPassword || 'test12'
  };
  
  console.log('Testing with payload:', JSON.stringify(payload, null, 2));
  
  fetch('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })
  .then(response => response.json())
  .then(data => {
    console.log('Response:', data);
    if (data.success) {
      console.log('✅ Manual signup successful!');
    } else {
      console.log('❌ Manual signup failed:', data.message);
      if (data.error?.details) {
        console.log('Validation errors:', data.error.details);
      }
    }
  })
  .catch(error => {
    console.log('❌ Network error:', error.message);
  });
};

console.log('🛠️ Debugging tools installed!');
console.log('💡 To test manually, run: testManualSignup("your@email.com", "password123", "Your Name", "password123")');