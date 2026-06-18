import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface CarbonMarketNews {
  title: string;
  snippet: string;
  url: string;
  countries: string[];
  tags: string[];
  date: Date;
}

export async function generateCarbonMarketNews(
  topic: string = "carbon markets"
): Promise<CarbonMarketNews[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Generate 5 realistic news articles about ${topic}.
  For each article, provide a JSON object with the following structure:
  {
    "title": "Article title",
    "snippet": "2-3 sentence summary",
    "url": "https://example.com/article-slug",
    "countries": ["Country1", "Country2"],
    "tags": ["tag1", "tag2", "tag3"],
    "date": "2025-05-31"
  }

  Return ONLY a valid JSON array of objects, no other text.
  Ensure the URLs are unique and realistic.
  Make the content relevant to carbon markets, emissions trading, carbon credits, and sustainability.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const articles = JSON.parse(cleanedText);

    return (articles as Array<Omit<CarbonMarketNews, 'date'> & { date: string }>).map((article) => ({
      ...article,
      date: new Date(article.date),
    }));
  } catch (error) {
    console.error("Error generating news with Gemini:", error);
    return [];
  }
}

export async function analyzeNewsForCarbonMetrics(
  newsContent: string
): Promise<{ sentiment: string; impact: string; keyMetrics: string[] }> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Analyze this carbon market news and provide:
  1. Sentiment (positive, neutral, negative)
  2. Impact assessment (high, medium, low)
  3. Key metrics or values mentioned

  News: "${newsContent}"

  Return a JSON object with sentiment, impact, and keyMetrics array.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error analyzing news:", error);
    return { sentiment: "neutral", impact: "low", keyMetrics: [] };
  }
}
