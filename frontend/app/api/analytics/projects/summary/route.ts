import { NextResponse } from "next/server";
import { getProjectSummary } from "@/lib/vcm-db";

export async function GET() {
  try {
    const data = await getProjectSummary();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[vcm] /projects/summary error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
