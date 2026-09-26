"use client";

import { useNotifications } from "@/context/NotificationContext";
import {
  Bell,
  Check,
  AlertCircle,
  Info as InfoIcon,
  ArrowLeft,
  Globe,
} from "lucide-react";
import { Starfield } from "@/components/ui/Starfield";
import { motion } from "framer-motion";
import Link from "next/link";
import LanguageSelector from "@/components/settings/LanguageSelector";

const SettingsClient = () => {
  const { preferences, updatePreferences } = useNotifications();

  const togglePreference = (type: keyof typeof preferences) => {
    updatePreferences({ [type]: !preferences[type] });
  };

  return (
    <div className="relative min-h-screen w-full bg-[#080b18] text-[#e8edf8] overflow-hidden">
      <Starfield />

      {/* Glow Orbs */}
      <div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-radial from-[#e8b84b]/10 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-radial from-blue-500/5 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-4xl mx-auto p-6 lg:p-12 space-y-12">
        <header className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#7a8aaa] hover:text-[#e8b84b] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-display font-bold tracking-tight text-white leading-tight">
              Platform <span className="text-[#e8b84b]">Settings</span>
            </h1>
            <p className="text-[#7a8aaa] max-w-xl text-lg font-light leading-relaxed">
              Tailor your transaction alerts and notification flows for a
              personalized experience.
            </p>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8b84b]/10 text-[#e8b84b] border border-[#e8b84b]/20">
                <Bell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">
                  Notification Preferences
                </h2>
                <p className="text-sm text-[#7a8aaa]">
                  Control which event types trigger real-time UI toasts.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {/* Success Alerts */}
            <div className="p-8 group hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">
                    <Check className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-white group-hover:text-[#e8b84b] transition-colors">
                      Success Alerts
                    </h3>
                    <p className="text-[#7a8aaa] text-sm leading-relaxed max-w-md font-light">
                      Visual confirmation for successful operations like payment
                      execution or profile updates.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => togglePreference("success")}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ring-offset-[#080b18] ring-[#e8b84b] focus:ring-2 ${
                    preferences.success ? "bg-[#e8b84b]" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-300 ease-in-out ${
                      preferences.success ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Error Alerts */}
            <div className="p-8 group hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-white group-hover:text-red-400 transition-colors">
                      System Errors
                    </h3>
                    <p className="text-[#7a8aaa] text-sm leading-relaxed max-w-md font-light">
                      Immediate toasts when transactions fail, network
                      connectivity issues occur, or validation errors arise.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => togglePreference("error")}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ring-offset-[#080b18] ring-red-500 focus:ring-2 ${
                    preferences.error ? "bg-[#e8b84b]" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-300 ease-in-out ${
                      preferences.error ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Info Alerts */}
            <div className="p-8 group hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <InfoIcon className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-white group-hover:text-blue-400 transition-colors">
                      Information & Tips
                    </h3>
                    <p className="text-[#7a8aaa] text-sm leading-relaxed max-w-md font-light">
                      Non-critical messages, onboarding guidance, and general
                      platform announcements.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => togglePreference("info")}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ring-offset-[#080b18] ring-blue-500 focus:ring-2 ${
                    preferences.info ? "bg-[#e8b84b]" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-300 ease-in-out ${
                      preferences.info ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white/[0.01] border-t border-white/5 flex justify-end">
            <p className="text-xs text-[#7a8aaa] italic">
              Settings are automatically synchronized to your local secure
              storage.
            </p>
          </div>
        </motion.div>

        {/* Language Preferences Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8b84b]/10 text-[#e8b84b] border border-[#e8b84b]/20">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">
                  Language Preferences
                </h2>
                <p className="text-sm text-[#7a8aaa]">
                  Choose your preferred language for the interface.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <LanguageSelector variant="list" />
          </div>

          <div className="p-8 bg-white/[0.01] border-t border-white/5 flex justify-end">
            <p className="text-xs text-[#7a8aaa] italic">
              Your language preference is saved locally and persists across
              sessions.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsClient;
