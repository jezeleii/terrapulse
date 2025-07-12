// app/articles-by-country/page.tsx
import prisma from "@/lib/prisma.js";

export const revalidate = 3600;      // ISR: re-generate every hour

export default async function ArticlesByCountryPage() {
  // 1. fetch titles + countries
  const articles = await prisma.article.findMany({
    select: { title: true, countries: true, date: true },
    orderBy: { date: 'desc' }
  });

  // 2. group by country
  const grouped = articles.reduce<Record<string,string[]>>((map, { title, countries }) => {
    countries.forEach(c => {
      if (!map[c]) map[c] = [];
      map[c].push(title);
    });
    return map;
  }, {});

  // 3. render
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Articles by Country</h1>
      {Object.entries(grouped).map(([country, titles]) => (
        <section key={country} className="mb-8">
          <h2 className="text-2xl font-semibold">{country}</h2>
          <ul className="list-disc list-inside mt-2">
            {titles.map((t,i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
