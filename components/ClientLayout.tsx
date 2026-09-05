'use client';

import { useEffect } from "react";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import OfflineBanner from "@/components/offline/OfflineBanner";
import QueuedActions from "@/components/offline/QueuedActions";
import { useNotifications } from "@/context/NotificationContext";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { addNotification } = useNotifications();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker
                    .register('/sw.js')
                    .then((registration) => {
                        console.log('[Service Worker] Registered with scope:', registration.scope);
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Registration failed:', error);
                    });
            });
        }
    }, []);

    useEffect(() => {
        const handleNotification = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail) {
                const { type, message } = customEvent.detail;
                addNotification(type, message);
            }
        };
        window.addEventListener('stellarspend_notification', handleNotification);
        return () => {
            window.removeEventListener('stellarspend_notification', handleNotification);
        };
    }, [addNotification]);

    return (
        <OfflineProvider>
            <OfflineBanner />
            <main className="min-h-screen">
                {children}
            </main>
            <QueuedActions />
        </OfflineProvider>
    );
}
