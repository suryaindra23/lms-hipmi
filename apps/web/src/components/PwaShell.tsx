"use client";

import { useEffect, useState } from "react";
import { Bell, Download, Moon, Sun, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { csrfFetch } from "@/lib/csrf";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaShell() {
  const [online, setOnline] = useState(true);
  const [unread, setUnread] = useState(0);
  const [dark, setDark] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("sunrise-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
    setDark(shouldUseDark);
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    const handleInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch(() => undefined);
        if ("caches" in window) {
          caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key.startsWith("sunrise-public-")).map((key) => caches.delete(key))))
            .catch(() => undefined);
        }
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    }
    fetch("/api/backend/support/notifications").then((response) => response.ok ? response.json() : []).then((items: Array<{ readAt?: string | null }>) => setUnread(items.filter((item) => !item.readAt).length)).catch(() => undefined);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); window.removeEventListener("beforeinstallprompt", handleInstall); };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("sunrise-theme", next ? "dark" : "light");
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      await csrfFetch("/api/backend/support/analytics/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName: "PWA_INSTALLED", consentGranted: localStorage.getItem("sunrise-analytics-consent") === "granted" }) }).catch(() => undefined);
    }
  }

  return <div className="flex items-center gap-1">
    <span title={online ? "Terhubung" : "Sedang offline"} className={`hidden items-center gap-1 rounded-full px-2 py-1 text-xs font-bold md:flex ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? "Online" : "Offline"}</span>
    {installPrompt && <button type="button" onClick={install} aria-label="Pasang aplikasi" title="Pasang aplikasi" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-orange-50"><Download size={18} /></button>}
    <Link href="/dashboard/dukungan" aria-label={`${unread} notifikasi belum dibaca`} className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-orange-50"><Bell size={19} />{unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold text-white">{Math.min(unread, 99)}</span>}</Link>
    <button type="button" onClick={toggleTheme} aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-orange-50">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
  </div>;
}
