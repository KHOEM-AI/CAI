import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import km from '@/locales/km.json';
import en from '@/locales/en.json';

export type Language = 'km' | 'en';
type TranslationDict = typeof km;

const dictionaries: Record<Language, TranslationDict> = { km, en };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationDict) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('cai_language');
    return saved === 'km' || saved === 'en' ? saved : 'km';
  });

  useEffect(() => {
    localStorage.setItem('cai_language', language);
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const t = (key: keyof TranslationDict) => dictionaries[language][key] ?? String(key);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
