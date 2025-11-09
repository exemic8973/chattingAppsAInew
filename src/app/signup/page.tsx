'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';


export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim() || !userName.trim()) {
      alert(t('validation.required'));
      return;
    }

    if (password !== confirmPassword) {
      alert(t('validation.passwordMatch'));
      return;
    }

    if (password.length < 6) {
      alert(t('validation.password'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          userName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(t('success'));
        router.push('/login');
      } else {
        alert(data.message || t('error.server'));
      }
    } catch (error) {
      console.error('Signup error:', error);
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
              <label htmlFor="userName" className="form-label">{t('signup.name')}</label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
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