'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';


export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 Signup form submitted!');
    console.log('Form data before validation:');
    console.log('Email:', email);
    console.log('Password:', password?.substring(0, 3) + '***');
    console.log('Full Name:', fullName);
    console.log('Confirm Password:', confirmPassword?.substring(0, 3) + '***');
    
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      console.log('❌ Validation failed: Required fields missing');
      alert(t('validation.required'));
      return;
    }

    if (password !== confirmPassword) {
      console.log('❌ Validation failed: Passwords do not match');
      alert(t('validation.passwordMatch'));
      return;
    }

    if (password.length < 6) {
      console.log('❌ Validation failed: Password too short');
      alert(t('validation.password'));
      return;
    }

    // Additional debugging - check fullName validation
    if (fullName.length < 2) {
      console.log('❌ Validation failed: Full name too short');
      alert('Full name must be at least 2 characters long');
      return;
    }
    
    if (fullName.length > 50) {
      console.log('❌ Validation failed: Full name too long');
      alert('Full name must be less than 50 characters');
      return;
    }
    
    if (!/^[a-zA-Z\s\-\']+$/.test(fullName)) {
      console.log('❌ Validation failed: Full name contains invalid characters');
      alert('Full name can only contain letters, spaces, hyphens, and apostrophes');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        email: email.trim(),
        password: password,
        fullName: fullName.trim(),
        confirmPassword: confirmPassword
      };
      
      console.log('📤 Sending to API:');
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📊 API Response status:', response.status);
      
      const data = await response.json();
      console.log('📋 API Response data:', data);

      if (response.ok) {
        console.log('✅ Signup successful!');
        alert(t('success'));
        router.push('/login');
      } else {
        console.log('❌ Signup failed:', data.message);
        console.log('Error details:', data.error);
        if (data.error?.details) {
          console.log('Validation errors:', JSON.stringify(data.error.details, null, 2));
          alert('Signup failed:\n' + JSON.stringify(data.error.details, null, 2));
        } else {
          alert(data.message || t('error.server'));
        }
      }
    } catch (error) {
      console.error('❌ Network/Server error:', error);
      alert(t('error.network'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen d-flex align-items-center justify-content-center p-4" style={{ marginTop: '20vh' }}>
        <div className="glass-morphism p-5" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="text-center mb-4">
            <h1 className="h2 mb-3">
              <i className="bi bi-person-plus-fill text-primary me-2"></i>
              {t('signup.title')}
            </h1>
            <p className="text-secondary">{t('signup.subtitle')}</p>
          </div>

          <form onSubmit={handleSignup}>
            <div className="mb-3">
              <label htmlFor="fullName" className="form-label">{t('signup.name')}</label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('signup.name')}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="email" className="form-label">{t('signup.email')}</label>
              <input
                type="email"
                className="form-control form-control-lg"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('signup.email')}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">{t('signup.password')}</label>
              <input
                type="password"
                className="form-control form-control-lg"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('signup.password')}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="form-label">{t('signup.confirmPassword')}</label>
              <input
                type="password"
                className="form-control form-control-lg"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('signup.confirmPassword')}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-100 gradient-bg border-0"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <i className="bi bi-person-plus me-2"></i>
                  {t('signup.button')}
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-4">
            <p className="text-secondary">
              {t('signup.loginPrompt')}{' '}
              <a href="/login" className="text-primary text-decoration-none">
                {t('signup.loginLink')}
              </a>
            </p>
          </div>

          <div className="text-center mt-3">
            <a href="/" className="text-decoration-none text-secondary">
              <i className="bi bi-arrow-left me-1"></i>
              {t('signup.backToHome')}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}