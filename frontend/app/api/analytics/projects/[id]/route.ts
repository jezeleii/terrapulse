import { type NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/vcm-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await getProjectById(id);
    if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[vcm] /projects/:id error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
