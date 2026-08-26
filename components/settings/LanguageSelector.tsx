"use client";

import React from "react";
import { useI18n } from "@/components/I18nProvider";
import { Globe } from "lucide-react";
import { motion } from "framer-motion";

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "sw", name: "Kiswahili", flag: "🇰🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
];

interface LanguageSelectorProps {
  variant?: "dropdown" | "list";
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = "dropdown",
  className = "",
}) => {
  const { language, changeLanguage, isRTL } = useI18n();

  const handleLanguageChange = async (lng: string) => {
    try {
      await changeLanguage(lng);
    } catch (error) {
      console.error("Failed to change language:", error);
    }
  };

  if (variant === "list") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2 text-[#e8b84b] mb-4">
          <Globe className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Language Preferences</h3>
        </div>
        <p className="text-sm text-[#7a8aaa] mb-4">
          Choose your preferred language for the interface.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {languages.map((lang) => (
            <motion.button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              lang={lang.code}
              dir={lang.code === "ar" ? "rtl" : "ltr"}
              className={`relative inline-flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                language === lang.code
                  ? "border-[#e8b84b] bg-[#e8b84b]/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-[#7a8aaa] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
              {language === lang.code && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -end-2 w-6 h-6 bg-[#e8b84b] rounded-full flex items-center justify-center"
                >
                  <svg
                    className="w-4 h-4 text-[#080b18]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // Dropdown variant (compact)
  return (
    <div className={`relative ${className}`}>
      <div className="inline-flex items-center gap-2">
        <Globe className="w-4 h-4 text-[#7a8aaa]" />
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-white/[0.02] border border-white/10 rounded-lg ps-3 pe-8 py-2 text-sm text-[#e8edf8] focus:outline-none focus:border-[#e8b84b]/50 focus:ring-1 focus:ring-[#e8b84b]/50 cursor-pointer appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237a8aaa'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: isRTL ? "left 0.5rem center" : "right 0.5rem center",
            backgroundSize: "1em 1em",
          }}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-[#080b18]">
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LanguageSelector;
