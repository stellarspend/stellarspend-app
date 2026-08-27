"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Settings,
  Menu,
  X,
  Gauge,
  ShieldCheck,
  PieChart,
} from "lucide-react";
import { Starfield } from "@/components/ui/Starfield";
import LanguageSelector from "@/components/settings/LanguageSelector";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/budgets", label: "Budgets", icon: PieChart },
  { href: "/dashboard/spending-limits", label: "Spending Limits", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#080b18] text-[#e8edf8] overflow-hidden">
      <Starfield />

      {/* Ambient glows */}
      <div
        className="pointer-events-none fixed -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10"
        style={{
          background: "radial-gradient(circle, #e8b84b 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-5"
        style={{
          background: "radial-gradient(circle, #4aa9e8 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#080b18]/80 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-[#e8b84b]" />
          <span className="text-base font-black text-white uppercase tracking-widest">
            StellarSpend
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector variant="dropdown" />
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="relative z-10 h-screen flex pt-[73px] lg:pt-0">
        {/* Sidebar */}
        <aside
          className={`
            fixed top-[73px] left-0 h-[calc(100vh-73px)] w-64 z-30 flex flex-col
            bg-[#080b18]/95 backdrop-blur-2xl border-r border-white/5
            transition-transform duration-300 ease-in-out
            lg:static lg:top-0 lg:h-screen lg:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8b84b]/10 border border-[#e8b84b]/20">
              <Gauge className="w-5 h-5 text-[#e8b84b]" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest leading-none">
                StellarSpend
              </p>
              <p className="text-[10px] text-[#7a8aaa] mt-0.5 uppercase tracking-wider">
                Dashboard
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav
            className="flex-1 px-4 py-6 space-y-1"
            aria-label="Dashboard navigation"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                    ${
                      active
                        ? "bg-[#e8b84b]/10 text-[#e8b84b] border border-[#e8b84b]/20"
                        : "text-[#7a8aaa] hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  {label}
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#e8b84b] animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom wallet stub */}
          <div className="px-4 pb-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-[10px] text-[#7a8aaa] uppercase tracking-widest font-bold mb-1">
                Connected Wallet
              </p>
              <p className="text-xs font-mono text-[#e8edf8] truncate">
                GDQD6A4P…R6AOTHO
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                <span className="text-[10px] text-[#4ade80] font-bold uppercase tracking-wider">
                  Testnet
                </span>
              </div>
            </div>

            {/* Language selector in sidebar */}
            <div className="pt-4 border-t border-white/5">
              <LanguageSelector variant="dropdown" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main
          id="main-content"
          className="flex-1 min-w-0 h-full overflow-y-auto p-4 md:p-8 lg:p-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
