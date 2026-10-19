import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiRequest, passThrough } from "@/lib/server-api";
import { validateCsrfRequest } from "@/lib/csrf-server";

const secure = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  if (!(await validateCsrfRequest(request))) {
    return NextResponse.json({ message: "Permintaan keamanan tidak valid" }, { status: 403 });
  }
  const body = await request.text();
  const upstream = await apiRequest("auth/login", { method: "POST", body });
  if (!upstream.ok) return passThrough(upstream);

  const data = await upstream.json();
  const cookieStore = await cookies();
  cookieStore.delete("sunrise_school");
  cookieStore.set("sunrise_access", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 15 * 60,
    priority: "high",
  });
  cookieStore.set("sunrise_refresh", data.refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/api",
    maxAge: 7 * 24 * 60 * 60,
    priority: "high",
  });

  return NextResponse.json({ user: data.user });
}

export async function GET() {
  return passThrough(await apiRequest("auth/me"));
}

export async function DELETE(request: Request) {
  if (!(await validateCsrfRequest(request))) {
    return NextResponse.json({ message: "Permintaan keamanan tidak valid" }, { status: 403 });
  }
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("sunrise_refresh")?.value;
  if (refreshToken) {
    await apiRequest("auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  cookieStore.delete("sunrise_access");
  cookieStore.delete("sunrise_refresh");
  cookieStore.delete("sunrise_school");
  cookieStore.delete("sunrise_csrf");
  return NextResponse.json({ success: true });
}
