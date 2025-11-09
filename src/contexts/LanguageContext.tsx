'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/lib/translations';

interface LanguageContextType {
  currentLanguage: LanguagePack;
  setLanguage: (langCode: string) => void;
  t: (key: string) => string;
  availableLanguages: LanguagePack[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguagePack>({
    code: 'en',
    name: 'English',
    flag: '🇺🇸'
  });

  useEffect(() => {
    const savedLang = localStorage.getItem('preferredLanguage');
    const browserLang = navigator.language.toLowerCase();
    
    let detectedLang = 'en';
    if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
      detectedLang = savedLang;
    } else if (browserLang.startsWith('zh')) {
      detectedLang = 'zh';
    }
    
    setCurrentLanguage({
      code: detectedLang,
      name: detectedLang === 'en' ? 'English' : '中文',
      flag: detectedLang === 'en' ? '🇺🇸' : '🇨🇳'
    });
  }, []);

  const setLanguage = (langCode: string) => {
    if (langCode === 'en' || langCode === 'zh') {
      setCurrentLanguage({
        code: langCode,
        name: langCode === 'en' ? 'English' : '中文',
        flag: langCode === 'en' ? '🇺🇸' : '🇨🇳'
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferredLanguage', langCode);
      }
    }
  };

  const t = (key: string): string => {
    return translations[currentLanguage.code][key] || translations.en[key] || key;
  };

  const availableLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ];

  return (
    <LanguageContext.Provider value={{ 
      currentLanguage, 
      setLanguage, 
      t, 
      availableLanguages 
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}