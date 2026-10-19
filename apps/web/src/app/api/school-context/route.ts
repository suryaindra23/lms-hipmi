import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiRequest, passThrough } from "@/lib/server-api";
import { validateCsrfRequest } from "@/lib/csrf-server";

const secure = process.env.NODE_ENV === "production";

type SchoolOption = { id: string; name: string };
type SchoolOptionsResponse = {
  schools?: SchoolOption[];
};

export async function POST(request: Request) {
  if (!(await validateCsrfRequest(request))) {
    return NextResponse.json(
      { message: "Permintaan keamanan tidak valid" },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | { schoolId?: unknown }
    | null;
  const schoolId =
    typeof payload?.schoolId === "string" ? payload.schoolId.trim() : "";
  if (!schoolId) {
    return NextResponse.json(
      { message: "Sekolah wajib dipilih" },
      { status: 400 },
    );
  }

  const upstream = await apiRequest("auth/schools");
  if (!upstream.ok) return passThrough(upstream);

  const options = (await upstream.json()) as SchoolOptionsResponse;
  const selected = options.schools?.find((school) => school.id === schoolId);
  if (!selected) {
    return NextResponse.json(
      { message: "Anda tidak memiliki akses ke sekolah tersebut" },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("sunrise_school", selected.id, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    priority: "high",
  });

  return NextResponse.json({ school: selected });
}
