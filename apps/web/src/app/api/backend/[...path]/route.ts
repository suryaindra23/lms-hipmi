import { apiRequest, passThrough } from "@/lib/server-api";
import { validateCsrfRequest } from "@/lib/csrf-server";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: Context) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !(await validateCsrfRequest(request))) {
    return Response.json({ message: "Permintaan keamanan tidak valid. Muat ulang halaman." }, { status: 403 });
  }
  const { path } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetPath = `${path.map(encodeURIComponent).join("/")}${incomingUrl.search}`;
  const contentType = request.headers.get("content-type");
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstream = await apiRequest(targetPath, {
    method: request.method,
    body,
    headers: contentType ? { "content-type": contentType } : undefined,
  });
  return passThrough(upstream);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
