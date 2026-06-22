"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '@/locales/en/common.json';
import commonEs from '@/locales/es/common.json';

const LANGUAGE_STORAGE_KEY = "stellarspend_language";
const SUPPORTED_LANGUAGES = ["en", "es"] as const;

function normalizeLanguage(lng: string | null | undefined): string | null {
  if (!lng) return null;
  const shortCode = lng.toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(shortCode as (typeof SUPPORTED_LANGUAGES)[number])
    ? shortCode
    : null;
}

function detectBrowserLanguage(): string | null {
  if (typeof window === "undefined") return null;
  const candidates = [window.navigator.language, ...Array.from(window.navigator.languages ?? [])];
  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }
  return null;
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
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)) ||
        detectBrowserLanguage() ||
        normalizeLanguage(initialLanguage) ||
        "en"
      );
    }
    return normalizeLanguage(initialLanguage) || "en";
  });

  useEffect(() => {
    // Set i18next language when language changes
    i18next.changeLanguage(language);
  }, [language]);

  const changeLanguage = async (lng: string) => {
    await i18next.changeLanguage(lng);
    setLanguage(lng);

    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
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
