import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export async function validateCsrfRequest(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) return false;

  const supplied = request.headers.get("x-csrf-token");
  const stored = (await cookies()).get("sunrise_csrf")?.value;
  if (!supplied || !stored) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
