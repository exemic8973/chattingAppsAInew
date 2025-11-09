'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/lib/translations';

interface LanguagePack {
  code: string;
  name: string;
  flag: string;
}

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
    const langCode = currentLanguage.code as 'en' | 'zh';
    return translations[langCode][key as keyof typeof translations.en] || translations.en[key as keyof typeof translations.en] || key;
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