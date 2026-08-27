"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Wallet,
  ChevronDown,
  ExternalLink,
  LogOut,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

// ── Nav link definitions ──────────────────────────────────────────────────────
interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
  {
    label: "GitHub",
    href: "https://github.com/Codex723/stellarspend-app",
    external: true,
  },
  { label: "Dashboard", href: "/dashboard" },
];

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <Link
      href="/"
      aria-label="StellarSpend home"
      className="flex items-center gap-2.5 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b84b] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080b18]"
    >
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#e8b84b]/10 group-hover:bg-[#e8b84b]/20 transition-colors duration-200" />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="relative z-10"
        >
          <path
            d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
            fill="#e8b84b"
            opacity="0.9"
          />
        </svg>
      </div>
      <span className="font-bold text-[15px] tracking-tight text-gray-900 dark:text-white">
        Stellar<span className="text-[#e8b84b]">Spend</span>
      </span>
    </Link>
  );
}

// ── Wallet connect button ─────────────────────────────────────────────────────
function WalletButton({ mobile = false }: { mobile?: boolean }) {
  const { freighter, connectFreighter, disconnectFreighter, formatAddress } =
    useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isConnected, publicKey, isConnecting, freighterError } = freighter;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  async function handleCopy() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Connected state ──────────────────────────────────────────────────────
  if (isConnected && publicKey) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Wallet menu"
          className={[
            "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
            "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            "hover:bg-emerald-500/20 hover:border-emerald-500/50",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080b18]",
            mobile ? "w-full justify-between" : "",
          ].join(" ")}
        >
          <span className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              aria-hidden="true"
            />
            <span className="font-mono text-[13px]">
              {formatAddress(publicKey, 6, 4)}
            </span>
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-md shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
              <p className="text-[10px] text-gray-500 dark:text-[#7a8aaa] uppercase tracking-widest mb-1.5 font-medium">
                Connected Wallet
              </p>
              <p className="font-mono text-[11px] text-gray-700 dark:text-white/70 break-all leading-relaxed">
                {publicKey}
              </p>
            </div>

            <div className="p-1.5 space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white transition-colors duration-100 focus-visible:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-white/[0.06]"
              >
                {copied ? (
                  <Check
                    size={15}
                    className="text-emerald-500 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy
                    size={15}
                    className="text-gray-400 dark:text-[#7a8aaa]"
                    aria-hidden="true"
                  />
                )}
                <span>{copied ? "Copied!" : "Copy public key"}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  disconnectFreighter();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 dark:text-red-400/80 hover:bg-red-50 dark:hover:bg-red-500/[0.08] hover:text-red-600 dark:hover:text-red-400 transition-colors duration-100 focus-visible:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-500/[0.08]"
              >
                <LogOut size={15} aria-hidden="true" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Disconnected state ───────────────────────────────────────────────────
  return (
    <div className={mobile ? "w-full space-y-1" : "space-y-1"}>
      <button
        type="button"
        onClick={connectFreighter}
        disabled={isConnecting}
        aria-busy={isConnecting}
        className={[
          "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
          "bg-[#e8b84b] text-[#1a0f00]",
          "hover:bg-[#f0c85a] hover:shadow-[0_4px_20px_rgba(232,184,75,0.3)]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-all duration-150 active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b84b] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080b18]",
          mobile ? "w-full" : "",
        ].join(" ")}
      >
        {isConnecting ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <Wallet size={15} aria-hidden="true" />
        )}
        <span>{isConnecting ? "Connecting…" : "Connect Wallet"}</span>
      </button>

      {freighterError && (
        <p role="alert" className="text-[11px] text-red-400 text-center">
          {freighterError}
        </p>
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Darken navbar on scroll — setState is inside a callback, not the effect body
  useEffect(() => {
    function onScroll() {
      startTransition(() => setScrolled(window.scrollY > 20));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const prevPathnameRef = useRef(pathname);

  // Close drawer on route change
  useEffect(() => {
    prevPathnameRef.current = pathname;
    startTransition(() => {
      setMobileOpen(false);
    });
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Move focus into drawer when it opens
  useEffect(() => {
    if (!mobileOpen) return;
    const timer = setTimeout(() => {
      const first = drawerRef.current?.querySelector<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      first?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  // Focus trap + Escape key handler
  const onDrawerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  return (
    <>
      {/* ── Fixed header ──────────────────────────────────────────────────── */}
      <header
        role="banner"
        className={[
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "border-b border-gray-200/70 dark:border-white/[0.07] bg-white/90 dark:bg-[#080b18]/90 backdrop-blur-xl shadow-lg shadow-black/10 dark:shadow-black/20"
            : "bg-transparent",
        ].join(" ")}
      >
        <nav
          aria-label="Main navigation"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        >
          <Logo />

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-1" role="list">
            {NAV_LINKS.map((link) => {
              const active = !link.external && pathname === link.href;
              return (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b84b] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#080b18]",
                      active
                        ? "text-[#e8b84b] bg-[#e8b84b]/[0.08]"
                        : "text-gray-600 dark:text-[#94a3b8] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    {link.label}
                    {link.external && (
                      <ExternalLink
                        size={12}
                        className="opacity-50"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <WalletButton />
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-drawer"
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 dark:text-[#94a3b8] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b84b]"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile backdrop ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      <div
        id="mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onKeyDown={onDrawerKeyDown}
        className={[
          "fixed top-0 right-0 bottom-0 z-50 w-[min(320px,90vw)]",
          "flex flex-col bg-white dark:bg-[#0d1117] border-l border-gray-200/80 dark:border-white/[0.07]",
          "shadow-2xl shadow-black/50 md:hidden",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 dark:border-white/[0.06]">
          <Logo />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 dark:text-[#94a3b8] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b84b]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label="Mobile navigation"
        >
          <ul className="space-y-0.5" role="list">
            {NAV_LINKS.map((link) => {
              const active = !link.external && pathname === link.href;
              return (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "flex items-center justify-between px-4 py-3 rounded-xl text-[15px] font-medium transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b84b] focus-visible:ring-inset",
                      active
                        ? "text-[#e8b84b] bg-[#e8b84b]/[0.08]"
                        : "text-gray-600 dark:text-[#94a3b8] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    {link.label}
                    {link.external && (
                      <ExternalLink
                        size={14}
                        className="opacity-40"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-4 py-5 border-t border-gray-100 dark:border-white/[0.06]">
          <p className="text-[10px] text-gray-500 dark:text-[#7a8aaa] uppercase tracking-widest mb-3 font-medium px-1">
            Wallet
          </p>
          <WalletButton mobile />
        </div>
      </div>

      <div className="h-16" aria-hidden="true" />
    </>
  );
}
