"use client";

import { useEffect, useState } from "react";
import { csrfFetch } from "@/lib/csrf";

export default function AnalyticsConsent() {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => { const saved = localStorage.getItem("sunrise-analytics-consent"); setChoice(saved); if (saved === "granted") csrfFetch("/api/backend/public/analytics/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName: "PAGE_VIEW", consentGranted: true, properties: { path: window.location.pathname } }) }).catch(() => undefined); }, []);
  function decide(value: "granted" | "denied") { localStorage.setItem("sunrise-analytics-consent", value); setChoice(value); if (value === "granted") csrfFetch("/api/backend/public/analytics/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName: "PAGE_VIEW", consentGranted: true, properties: { path: window.location.pathname } }) }).catch(() => undefined); }
  if (choice) return null;
  return <aside className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl border border-slate-900/15 bg-white p-4 shadow-2xl" aria-label="Pilihan analitik"><p className="text-sm font-bold text-slate-900">Bantu kami memperbaiki pengalaman</p><p className="mt-1 text-xs leading-5 text-slate-600">Analitik opsional hanya mencatat interaksi umum tanpa kata sandi atau nomor identitas. Anda dapat menolak dan tetap memakai situs.</p><div className="mt-3 flex gap-2"><button onClick={() => decide("granted")} className="min-h-10 rounded-md bg-slate-950 px-4 text-xs font-bold text-white">Izinkan analitik</button><button onClick={() => decide("denied")} className="min-h-10 rounded-md border border-slate-900/15 px-4 text-xs font-bold text-slate-700">Tolak</button></div></aside>;
}
