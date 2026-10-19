import { cookies } from "next/headers";
import { createHash } from "node:crypto";

const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "");

type RefreshedSession = { accessToken: string; refreshToken: string };
const refreshState = globalThis as typeof globalThis & {
  sunriseRefreshFlights?: Map<string, Promise<RefreshedSession | null>>;
};
const refreshFlights = refreshState.sunriseRefreshFlights ??= new Map();

async function refreshSession(refreshToken: string) {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = refreshFlights.get(key);
  if (existing) return existing;

  const flight = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
      if (!response.ok) return null;
      return await response.json() as RefreshedSession;
    } catch {
      return null;
    }
  })();
  refreshFlights.set(key, flight);
  void flight.then(() => {
    setTimeout(() => {
      if (refreshFlights.get(key) === flight) refreshFlights.delete(key);
    }, 2_000);
  });
  return flight;
}

export async function apiRequest(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sunrise_access")?.value;
  const schoolId = cookieStore.get("sunrise_school")?.value;
  const headers = new Headers(init.headers);

  if (token) headers.set("authorization", `Bearer ${token}`);
  if (token && schoolId) headers.set("x-school-id", schoolId);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const target = `${API_URL}/${path.replace(/^\//, "")}`;
  let response = await fetch(target, {
    ...init,
    headers,
    cache: "no-store",
  });

  const refreshToken = cookieStore.get("sunrise_refresh")?.value;
  const isAuthOperation = path.startsWith("auth/login") || path.startsWith("auth/refresh");
  if (response.status !== 401 || !refreshToken || isAuthOperation) return response;

  const refreshed = await refreshSession(refreshToken);
  if (!refreshed) {
    cookieStore.delete("sunrise_access");
    cookieStore.delete("sunrise_refresh");
    return response;
  }

  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("sunrise_access", refreshed.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 15 * 60,
    priority: "high",
  });
  cookieStore.set("sunrise_refresh", refreshed.refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/api",
    maxAge: 7 * 24 * 60 * 60,
    priority: "high",
  });
  headers.set("authorization", `Bearer ${refreshed.accessToken}`);
  response = await fetch(target, { ...init, headers, cache: "no-store" });
  return response;
}

export async function passThrough(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  headers.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers });
}
