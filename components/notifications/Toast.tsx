"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Notification, useNotifications } from "@/context/NotificationContext";

const icons = {
  success: <CheckCircle className="w-5 h-5 text-[#e8b84b]" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
};

const styles = {
  success: "border-[#e8b84b]/30 bg-[#e8b84b]/10 text-white shadow-[#e8b84b]/5",
  error: "border-red-500/30 bg-red-500/10 text-white shadow-red-500/5",
  info: "border-blue-500/30 bg-blue-500/10 text-white shadow-blue-500/5",
};

export const Toast: React.FC<Notification> = ({ id, type, message }) => {
  const { removeToast } = useNotifications();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`flex items-center gap-4 p-4 mb-3 min-w-[320px] max-w-md border rounded-2xl shadow-2xl backdrop-blur-xl ${styles[type]}`}
      // aria-live="polite" announces toast messages to screen readers without interrupting current speech
      aria-live="polite"
    >
      <div className="flex-shrink-0 relative">
        {icons[type]}
        {type === 'success' && <div className="absolute inset-0 bg-[#e8b84b]/20 blur-md rounded-full -z-10" />}
      </div>
      <div className="flex-grow text-sm font-light tracking-wide leading-relaxed">{message}</div>
      <button
        onClick={() => removeToast(id)}
        className="flex-shrink-0 p-1.5 rounded-xl hover:bg-white/10 transition-colors text-[var(--color-text-secondary)] hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const Toaster: React.FC = () => {
  const { toasts } = useNotifications();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
