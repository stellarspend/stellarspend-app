import type { Metadata } from "next";
import "./globals.css";

import ClientLayout from "@/components/ClientLayout";
import { NotificationProvider } from "@/context/NotificationContext";
import { WalletProvider } from "@/context/WalletContext";
import { Toaster } from "@/components/notifications/Toast";
import { I18nProvider } from "@/components/I18nProvider";
import Footer from "@/components/footer/Footer";
import Navbar from "@/components/navbar/Navbar";

export const metadata: Metadata = {
  title: "StellarSpend — Financial Freedom on the Blockchain",
  description:
    "StellarSpend helps the unbanked and underbanked track spending, manage budgets, and build savings using the low-cost Stellar blockchain. No bank account required.",
  keywords: ["stellar", "blockchain", "budgeting", "finance", "XLM", "USDC", "unbanked"],
  openGraph: {
    title: "StellarSpend — Financial Freedom on the Blockchain",
    description:
      "Track spending, manage budgets, and build savings on the Stellar network.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Keep the server-rendered HTML stable and let the client update direction/language after mount.
  return (
    <html lang="en" dir="ltr">
      <body
        className="antialiased font-sans"
      >
        <I18nProvider initialLanguage="en">
          <NotificationProvider>
            <ClientLayout>
              <WalletProvider>
                {/* Skip-to-content link for keyboard accessibility */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 bg-[#e8b84b] text-[#1a0f00] px-4 py-2 rounded-md font-semibold z-50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b] focus:ring-offset-2 focus:ring-offset-[#080b18]"
                >
                  Skip to main content
                </a>

                {/* Global navbar — rendered on every page */}
                <Navbar />

                {/* Page content */}
                <main id="main-content" style={{ minHeight: "100dvh" }}>
                  {children}
                </main>

                <Footer />
                <Toaster />
              </WalletProvider>
            </ClientLayout>
          </NotificationProvider>
        </I18nProvider>
      </body>
    </html>
  );
}