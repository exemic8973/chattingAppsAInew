'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { currentLanguage, setLanguage, availableLanguages } = useLanguage();

  const switchLanguage = () => {
    const nextLang = currentLanguage.code === 'en' ? 'zh' : 'en';
    setLanguage(nextLang);
  };

  return (
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
  );
}