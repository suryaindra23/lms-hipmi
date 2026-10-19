import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const secure = process.env.NODE_ENV === "production";

export async function GET() {
  const token = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("sunrise_csrf", token, {
    httpOnly: false,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: 2 * 60 * 60,
    priority: "high",
  });
  return NextResponse.json({ token }, { headers: { "cache-control": "no-store" } });
}
