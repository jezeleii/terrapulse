import { generateCarbonMarketNews } from "../lib/gemini-service";
import prisma from "../lib/prisma";

const carbonTopics = [
  "carbon credit markets",
  "emissions trading systems",
  "carbon offset projects",
  "net-zero commitments",
  "carbon pricing policies",
];

async function seedCarbonNews() {
  console.log("Fetching carbon market news from Gemini...");

  try {
    for (const topic of carbonTopics) {
      console.log(`\nFetching news for: ${topic}`);
      const articles = await generateCarbonMarketNews(topic);

      for (const article of articles) {
        try {
          const existing = await prisma.article.findUnique({
            where: { url: article.url },
          });

          if (!existing) {
            await prisma.article.create({
              data: {
                title: article.title,
                snippet: article.snippet,
                url: article.url,
                date: article.date,
                tags: article.tags,
                countries: article.countries,
              },
            });
            console.log(`✓ Created: ${article.title}`);
          } else {
            console.log(`⊘ Already exists: ${article.title}`);
          }
        } catch (error) {
          console.error(`Error creating article: ${error}`);
        }
      }
    }

    console.log("\n✅ Carbon news seeding complete!");
  } catch (error) {
    console.error("Error seeding carbon news:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCarbonNews();
