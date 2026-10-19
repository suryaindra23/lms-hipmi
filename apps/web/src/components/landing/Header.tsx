"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

const navLinks = [
  { href: "/#about", label: "Tentang program" },
  { href: "/#features", label: "Produk & fitur" },
  { href: "/#how-it-works", label: "Alur belajar" },
  { href: "/#galeri", label: "Cerita kegiatan" },
  { href: "/#team", label: "Tim kami" },
  { href: "/paket", label: "Paket belajar" },
  { href: "/#security", label: "Keamanan" },
];

type SessionProfile = { email?: string; roles?: string[]; schoolId?: string | null };

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<SessionProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = response.ok ? await response.json() as SessionProfile : null;
        if (active) setSession(data);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setSessionLoading(false);
      }
    };
    void loadSession();
    const refresh = () => { if (document.visibilityState === "visible") void loadSession(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (!isOpen) return () => { document.body.style.overflow = ""; };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:h-24 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Sunrise Academy — Beranda" onClick={() => setIsOpen(false)}>
          <BrandLogo className="text-lg sm:text-xl" priority />
        </Link>
        <div className="flex items-center gap-5">
          {!sessionLoading && session && (
            <Link href="/dashboard" className="hidden items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-orange-700 sm:inline-flex">
              Dashboard <LayoutDashboard aria-hidden="true" size={16} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="inline-flex size-11 items-center justify-center text-slate-950 transition hover:text-orange-700"
            aria-expanded={isOpen}
            aria-controls="site-navigation"
            aria-label={isOpen ? "Tutup menu" : "Buka menu"}
          >
            {isOpen ? <X aria-hidden="true" size={28} strokeWidth={1.5} /> : <Menu aria-hidden="true" size={28} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <button type="button" aria-label="Tutup menu" onClick={() => setIsOpen(false)} className="fixed inset-x-0 top-20 z-40 h-[calc(100dvh-5rem)] bg-slate-950/20 sm:top-24 sm:h-[calc(100dvh-6rem)]" />
          <div id="site-navigation" className="fixed right-0 top-20 z-50 flex h-[calc(100dvh-5rem)] w-full max-w-[540px] flex-col overflow-y-auto bg-white px-6 pb-10 pt-5 shadow-2xl sm:top-24 sm:h-[calc(100dvh-6rem)] sm:px-12">
            <p className="mb-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-700">Jelajahi Sunrise Academy</p>
            <nav aria-label="Navigasi utama" className="flex-1">
              {navLinks.map((link, index) => (
                <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)} className="group flex min-h-16 items-center justify-between gap-5 border-b border-slate-200 py-3 text-xl font-bold tracking-tight text-slate-950 transition hover:text-orange-700 sm:text-2xl">
                  <span>{link.label}</span>
                  <span className="text-xs font-bold tabular-nums text-slate-400 transition group-hover:text-orange-700">{String(index + 1).padStart(2, "0")}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-9 grid gap-3">
              <Link href="/#register" onClick={() => setIsOpen(false)} className="inline-flex min-h-12 items-center justify-between rounded-full border border-orange-700 px-5 text-sm font-bold text-orange-700 transition hover:bg-orange-50">
                Hubungi tim kami <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link href={session ? "/dashboard" : "/login"} onClick={() => setIsOpen(false)} className="inline-flex min-h-12 items-center justify-between rounded-full bg-orange-600 px-5 text-sm font-bold text-white transition hover:bg-orange-700">
                {session ? "Buka dashboard" : "Masuk ke platform"} <ArrowRight aria-hidden="true" size={18} />
              </Link>
              {session && <p className="pt-2 text-xs text-slate-500">Masuk sebagai {session.email?.split("@")[0] || "pengguna"}</p>}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
