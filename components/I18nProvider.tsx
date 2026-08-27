"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '@/locales/en/common.json';
import commonEs from '@/locales/es/common.json';
import commonFr from '@/locales/fr/common.json';
import commonSw from '@/locales/sw/common.json';
import commonPt from '@/locales/pt/common.json';
import commonAr from '@/locales/ar/common.json';
import { isRTL as computeIsRTL, getIntlLocale, SUPPORTED_LANGUAGES } from '@/lib/i18n-locale';

const LANGUAGE_STORAGE_KEY = "stellarspend_language";

/**
 * Detect the browser's preferred language and match to supported languages.
 * Falls back to 'en' if no match is found.
 */
function detectBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";

  // Get browser languages in order of preference
  const browserLanguages = navigator.languages || [navigator.language];

  for (const browserLang of browserLanguages) {
    // Extract the language code (e.g., 'en-US' -> 'en')
    const langCode = browserLang.split("-")[0].toLowerCase();
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(langCode)) {
      return langCode;
    }
  }

  return "en";
}



// Initialize i18next
i18next.use(initReactI18next).init({
  resources: {
    en: { translation: commonEn },
    es: { translation: commonEs },
    fr: { translation: commonFr },
    sw: { translation: commonSw },
    pt: { translation: commonPt },
    ar: { translation: commonAr },
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
  dir: "ltr" | "rtl";
  isRTL: boolean;
  intlLocale: string;
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

function applyDocumentDirection(lng: string) {
  if (typeof document === "undefined") return;
  const rtl = computeIsRTL(lng);
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLanguage = "en",
}) => {
  const [language, setLanguage] = useState(initialLanguage);
  const [, startTransition] = useTransition();

  // Hydration effect: restore language from localStorage or detect browser language
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const resolvedLanguage = stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)
      ? stored
      : detectBrowserLanguage();
    if (resolvedLanguage !== language) startTransition(() => setLanguage(resolvedLanguage));
  }, [language]);

  // Apply language changes to i18next and document direction
  useEffect(() => {
    void i18next.changeLanguage(language);
    applyDocumentDirection(language);
  }, [language]);

  const changeLanguage = async (lng: string) => {
    // Validate the language is supported
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lng)) {
      console.warn(`Unsupported language: ${lng}. Falling back to 'en'.`);
      lng = "en";
    }

    await i18next.changeLanguage(lng);
    setLanguage(lng);
    applyDocumentDirection(lng);

    // Persist to localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
      } catch (error) {
        console.error("Failed to save language preference to localStorage:", error);
      }
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

  const rtl = computeIsRTL(language);

  return (
    <I18nContext.Provider
      value={{
        language,
        changeLanguage,
        t,
        dir: rtl ? "rtl" : "ltr",
        isRTL: rtl,
        intlLocale: getIntlLocale(language),
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export { i18next };
export default i18next;
