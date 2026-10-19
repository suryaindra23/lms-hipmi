import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiRequest, passThrough } from "@/lib/server-api";

type MaterialAccess = {
  id: string;
  title: string;
  originalFileName: string;
  mimeType?: string | null;
  previewSlideCount?: number | null;
};

const webRoot = process.cwd().endsWith(path.join("apps", "web"))
  ? process.cwd()
  : path.join(process.cwd(), "apps", "web");
const materialRoot = path.join(webRoot, "private", "materials");

function privateHeaders(contentType: string, disposition?: string) {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
  if (disposition) headers.set("content-disposition", disposition);
  return headers;
}

async function loadFile(filePath: string, contentType: string, disposition?: string) {
  try {
    const contents = await readFile(filePath);
    return new Response(contents, { headers: privateHeaders(contentType, disposition) });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ message: "File materi belum tersedia" }, { status: 404 });
    }
    throw error;
  }
}

export async function GET(request: Request, context: RouteContext<"/api/materials/[id]">) {
  const { id } = await context.params;
  const upstream = await apiRequest(`learning/materials/${encodeURIComponent(id)}/access`);
  if (!upstream.ok) return passThrough(upstream);

  const material = await upstream.json() as MaterialAccess;
  const safeFileName = path.basename(material.originalFileName);
  if (safeFileName !== material.originalFileName || !safeFileName.toLowerCase().endsWith(".pptx")) {
    return Response.json({ message: "Nama file materi tidak valid" }, { status: 400 });
  }

  const url = new URL(request.url);
  const slideParam = url.searchParams.get("slide");
  const slideCount = Number(material.previewSlideCount || 0);
  if (slideParam !== null) {
    const slide = Number(slideParam);
    if (!Number.isInteger(slide) || slide < 1 || slide > slideCount) {
      return Response.json({ message: "Slide materi tidak tersedia" }, { status: 404 });
    }
    const previewFolder = path.basename(safeFileName, path.extname(safeFileName));
    return loadFile(
      path.join(materialRoot, "previews", previewFolder, `slide-${slide}.png`),
      "image/png",
    );
  }

  if (url.searchParams.get("download") === "1") {
    return loadFile(
      path.join(materialRoot, safeFileName),
      material.mimeType || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      `attachment; filename="${safeFileName}"`,
    );
  }

  return Response.json({
    id: material.id,
    title: material.title,
    slideCount,
    downloadUrl: `/api/materials/${encodeURIComponent(material.id)}?download=1`,
  }, { headers: { "cache-control": "private, no-store" } });
}
