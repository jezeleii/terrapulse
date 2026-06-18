import { NextResponse } from "next/server";
import { getDashboardTimeline } from "@/lib/vcm-db";

export async function GET() {
  try {
    const data = await getDashboardTimeline();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[vcm] /dashboard/timeline error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
