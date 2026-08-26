"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type NotificationType = "success" | "error" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationPreferences {
  success: boolean;
  error: boolean;
  info: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
}



interface NotificationContextType {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
}
export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "stellarspend_notifications";
const PREFS_KEY = "stellarspend_notification_preferences";

function loadNotifications(): Notification[] {
  if (typeof window === "undefined") {
    return [];
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved) as Notification[];
  } catch (error) {
    console.error("Failed to parse saved notifications", error);
    return [];
  }
}

function loadPreferences(): NotificationPreferences {
  if (typeof window === "undefined") {
    return {
      success: true,
      error: true,
      info: true,
    };
  }

  const saved = localStorage.getItem(PREFS_KEY);
  if (!saved) {
    return {
      success: true,
      error: true,
      info: true,
    };
  }

  try {
    return JSON.parse(saved) as NotificationPreferences;
  } catch (error) {
    console.error("Failed to parse saved preferences", error);
    return {
      success: true,
      error: true,
      info: true,
    };
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] =
    useState<Notification[]>(loadNotifications);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(loadPreferences);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    }
  }, [notifications]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
    }
  }, [preferences]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addNotification = useCallback(
    (type: NotificationType, message: string) => {
      const newNotification: Notification = {
        id: Math.random().toString(36).substring(2, 11),
        type,
        message,
        timestamp: Date.now(),
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);

      if (preferences[type]) {
        setToasts((prev) => [...prev, newNotification]);

        setTimeout(() => {
          removeToast(newNotification.id);
        }, 5000);
      }
    },
    [preferences, removeToast],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true })),
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updatePreferences = useCallback(
    (newPrefs: Partial<NotificationPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...newPrefs }));
    },
    [],
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeToast,
        clearAll,
        preferences,
        updatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};
