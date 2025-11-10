'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function GlobalNav() {
  const { currentLanguage, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    router.push('/');
  };

  const switchLanguage = () => {
    const nextLang = currentLanguage.code === 'en' ? 'zh' : 'en';
    setLanguage(nextLang);
  };

  return (
    <div
      className="position-fixed d-flex gap-2 align-items-center"
      style={{
        top: '20px',
        right: '20px',
        zIndex: 9999
      }}
    >
      {/* Language Switcher */}
      <button
        onClick={switchLanguage}
        className="btn btn-outline-secondary btn-sm"
        style={{
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}
        title={`Switch to ${currentLanguage.code === 'en' ? '中文' : 'English'}`}
      >
        {currentLanguage.flag} {currentLanguage.code === 'en' ? '中文' : 'EN'}
      </button>

      {/* Logout Button */}
      {isAuthenticated && (
        <button
          onClick={handleLogout}
          className="btn btn-outline-danger btn-sm"
          style={{
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
          title={t('logout')}
        >
          <i className="bi bi-box-arrow-right me-1"></i>
          {t('logout')}
        </button>
      )}
    </div>
  );
}