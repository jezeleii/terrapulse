import { NextResponse } from "next/server";
import { getDashboardOverview } from "@/lib/vcm-db";

export async function GET() {
  try {
    const data = await getDashboardOverview();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[vcm] /dashboard/overview error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
