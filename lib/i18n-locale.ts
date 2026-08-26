/**
 * lib/i18n-locale.ts
 *
 * Internationalization locale utilities for StellarSpend. Maps supported
 * language codes to Intl and date-fns locale objects, provides RTL detection,
 * and offers locale-aware formatting helpers for amounts and dates.
 */

import { enUS, es, fr, pt, ar as arSA } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

// Swahili has no dedicated date-fns locale pack as of date-fns v3;
// we fall back to enUS formatting rules for sw (month/day names are
// pulled from the sw translation strings elsewhere in the app, this
// only governs numeric layout/ordering).
export const SUPPORTED_LANGUAGES = ["en", "es", "fr", "sw", "pt", "ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const RTL_LANGUAGES: SupportedLanguage[] = ["ar"];

/**
 * Checks whether a given language code is a right-to-left language.
 * @param lang - The language code to check (e.g. 'ar').
 * @returns True if the language is RTL, false otherwise.
 */
export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as SupportedLanguage);
}

// BCP-47 tags used for Intl.NumberFormat / Intl.DateTimeFormat
const INTL_LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  sw: "sw-KE",
  pt: "pt-PT",
  ar: "ar-SA",
};

// date-fns Locale objects for use with format(), formatDistance(), etc.
const DATE_FNS_LOCALE_MAP: Record<SupportedLanguage, DateFnsLocale> = {
  en: enUS,
  es: es,
  fr: fr,
  sw: enUS,
  pt: pt,
  ar: arSA,
};

/**
 * Returns the BCP-47 Intl locale tag for a supported language code.
 * @param lang - The language code (e.g. 'sw', 'ar').
 * @returns The BCP-47 tag (e.g. 'sw-KE', 'ar-SA'), defaulting to 'en-US'.
 */
export function getIntlLocale(lang: string): string {
  return INTL_LOCALE_MAP[lang as SupportedLanguage] ?? "en-US";
}

/**
 * Returns the date-fns Locale object for a supported language code.
 * @param lang - The language code.
 * @returns The corresponding date-fns Locale, defaulting to enUS.
 */
export function getDateFnsLocale(lang: string): DateFnsLocale {
  return DATE_FNS_LOCALE_MAP[lang as SupportedLanguage] ?? enUS;
}

/**
 * Format a numeric amount per-locale. Currency code is passed separately
 * since on-chain assets (XLM, USDC, EURC, ...) aren't ISO-4217 currencies;
 * for those we format as a decimal and append the asset code ourselves.
 */
export function formatAmount(
  amount: number,
  lang: string,
  options?: { currencyCode?: string; maximumFractionDigits?: number },
): string {
  const locale = getIntlLocale(lang);
  const { currencyCode, maximumFractionDigits = 7 } = options ?? {};

  if (currencyCode && ["USD", "EUR", "GBP", "KES", "NGN"].includes(currencyCode)) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(amount);
}

/**
 * Formats a date value using locale-aware Intl.DateTimeFormat.
 * @param date - The date to format (Date, timestamp, or ISO string).
 * @param lang - The language code for formatting.
 * @param options - Optional overrides for Intl.DateTimeFormat.
 * @returns The formatted date string.
 */
export function formatDate(
  date: Date | number | string,
  lang: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale = getIntlLocale(lang);
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(d);
}