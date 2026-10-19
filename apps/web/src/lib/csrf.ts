function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function csrfToken() {
  const existing = readCookie("sunrise_csrf");
  if (existing) return decodeURIComponent(existing);
  const response = await fetch("/api/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Tidak dapat menyiapkan permintaan aman");
  const data = (await response.json()) as { token: string };
  return data.token;
}

export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return fetch(input, init);
  const headers = new Headers(init.headers);
  headers.set("x-csrf-token", await csrfToken());
  return fetch(input, { ...init, headers });
}
