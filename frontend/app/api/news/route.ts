import { type NextRequest, NextResponse } from "next/server";
import { generateCarbonMarketNews, analyzeNewsForCarbonMetrics } from "@/lib/gemini-service";

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get("topic") ?? "carbon credit markets";
  const analyze = req.nextUrl.searchParams.get("analyze") === "true";

  try {
    const news = await generateCarbonMarketNews(topic);

    if (!analyze) {
      return NextResponse.json(news.map((a) => ({ ...a, date: a.date.toISOString() })));
    }

    const withAnalysis = await Promise.all(
      news.map(async (article) => {
        const analysis = await analyzeNewsForCarbonMetrics(`${article.title}. ${article.snippet}`);
        return { ...article, date: article.date.toISOString(), analysis };
      }),
    );

    return NextResponse.json(withAnalysis);
  } catch (err) {
    console.error("[news] /api/news error:", err);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
