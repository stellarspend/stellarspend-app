"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '@/locales/en/common.json';
import commonEs from '@/locales/es/common.json';

const LANGUAGE_STORAGE_KEY = "stellarspend_language";
const SUPPORTED_LANGUAGES = ["en", "es"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function normalizeLanguage(value?: string | null): SupportedLanguage | null {
  if (!value) {
    return null;
  }

  const languageCode = value.toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(languageCode as SupportedLanguage)
    ? (languageCode as SupportedLanguage)
    : null;
}

function getStartupLanguage(initialLanguage: string): SupportedLanguage {
  const fallback = normalizeLanguage(initialLanguage) ?? "en";

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const savedLanguage = normalizeLanguage(
      localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );

    if (savedLanguage) {
      return savedLanguage;
    }
  } catch {
    // Continue to browser language detection when storage is unavailable.
  }

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  const browserLanguage = browserLanguages
    .map((lng) => normalizeLanguage(lng))
    .find(Boolean);

  return browserLanguage ?? fallback;
}

// Initialize i18next
i18next.use(initReactI18next).init({
  resources: {
    en: { translation: commonEn },
    es: { translation: commonEs },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

interface I18nContextType {
  language: string;
  changeLanguage: (lng: string) => Promise<void>;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};

interface I18nProviderProps {
  children: React.ReactNode;
  initialLanguage?: string;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLanguage = "en",
}) => {
  const [language, setLanguage] = useState(() =>
    getStartupLanguage(initialLanguage),
  );

  useEffect(() => {
    // Set i18next language when language changes
    i18next.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = async (lng: string) => {
    const nextLanguage = normalizeLanguage(lng) ?? "en";
    await i18next.changeLanguage(nextLanguage);
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  };

  const t = (key: string): string => {
    let value: string = i18next.t(key);

    // Fallback to English if translation not found
    if (value === key && language !== 'en') {
      const savedLng = i18next.language;
      i18next.language = 'en';
      value = i18next.t(key);
      i18next.changeLanguage(savedLng);
    }

    return value || key;
  };

  return (
    <I18nContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export { i18next };
export default i18next;
