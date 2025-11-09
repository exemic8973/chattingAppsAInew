'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import AuthDebug from '@/components/AuthDebug';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      alert(t('validation.required'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userName', data.userName);
        localStorage.setItem('userId', data.userId);
        
        // Redirect to room creation page
        router.push('/create-room');
      } else {
        alert(data.message || t('error.authenticationFailed'));
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(t('error.network'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <AuthDebug />
      <div className="min-h-screen d-flex align-items-center justify-content-center p-4" style={{ marginTop: '20vh' }}>
        <div className="glass-morphism p-5" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="text-center mb-4">
            <h1 className="h2 mb-3">
              <i className="bi bi-box-arrow-in-right text-primary me-2"></i>
              {t('login.title')}
            </h1>
            <p className="text-secondary">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">{t('login.email')}</label>
              <input
                type="email"
                className="form-control form-control-lg"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.email')}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label">{t('login.password')}</label>
              <input
                type="password"
                className="form-control form-control-lg"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.password')}
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
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  {t('login.button')}
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-4">
            <p className="text-secondary">
              {t('login.signupPrompt')}{' '}
              <a href="/signup" className="text-primary text-decoration-none">
                {t('login.signupLink')}
              </a>
            </p>
          </div>

          <div className="text-center mt-3">
            <a href="/" className="text-decoration-none text-secondary">
              <i className="bi bi-arrow-left me-1"></i>
              {t('login.backToHome')}
            </a>
          </div>

          <div className="mt-4 p-3 bg-light rounded">
            <p className="small text-muted mb-0">
              <i className="bi bi-info-circle me-1"></i>
              <strong>{t('common.info')}:</strong> {t('login.note')}
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}