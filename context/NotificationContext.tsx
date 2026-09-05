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
/**
 * React context that manages in-app notifications and toast messages.
 *
 * Provides persistent notifications (stored in localStorage) and
 * ephemeral toast alerts that auto-dismiss after 5 seconds.
 *
 * @example
 * ```tsx
 * // Consume via the hook:
 * const { addNotification, notifications } = useNotifications();
 *
 * // Trigger a toast + persistent notification:
 * addNotification("success", "Payment sent!");
 *
 * // Read all notifications:
 * notifications.forEach(n => console.log(n.message, n.read));
 * ```
 */
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

/**
 * Provider component that wraps the application and supplies
 * notification state and actions via {@link NotificationContext}.
 *
 * - Persists notifications and user preferences to localStorage.
 * - Toasts are ephemeral and auto-remove after 5 seconds.
 * - Users can toggle which notification types appear as toasts.
 *
 * @param children - Child components that will have access to notifications.
 */
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
        }, 4000);
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

/**
 * Hook to access the notification context.
 *
 * Must be used within a {@link NotificationProvider}.
 *
 * @returns The notification context containing notifications, toasts,
 *   and action methods like `addNotification`, `markAsRead`, etc.
 * @throws Error if used outside of a `NotificationProvider`.
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};
