import { type NextRequest, NextResponse } from "next/server";
import { listProjects } from "@/lib/vcm-db";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 500);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
  try {
    const data = await listProjects(limit, offset);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[vcm] /projects error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
