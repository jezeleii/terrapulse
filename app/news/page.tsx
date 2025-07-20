"use client";
import prisma from '@/lib/prisma';
import { Article } from '@prisma/client';

interface ArticlePreview {
  title: string;
  snippet: string;
  url: string;
  date: Date;
  countries: string[];
}

interface GroupedArticles {
  [country: string]: ArticlePreview[];
}

export const revalidate = 3600; // Revalidate data every hour

export default async function ArticlesByCountryPage() {
  // 1. Fetch relevant fields from the database with proper typing
  const articles = await prisma.article.findMany({
    select: {
      title: true,
      snippet: true,
      url: true,
      date: true,
      countries: true,
    },
    orderBy: { date: 'desc' },
  }) as ArticlePreview[];

  // 2. Group articles by country with type safety
  const grouped = articles.reduce<GroupedArticles>((map, article) => {
    const keys = article.countries.length ? article.countries : ['Uncategorized'];
    keys.forEach(country => {
      if (!map[country]) map[country] = [];
      map[country].push(article);
    });
    return map;
  }, {});

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Articles by Country</h1>
      {Object.keys(grouped).length === 0 ? (
        <p className="text-gray-600">
          No articles available. Run <code className="bg-gray-100 px-1 rounded">node prisma/seed.js</code> to seed data.
        </p>
      ) : (
        Object.entries(grouped).map(([country, items]) => (
          <section key={country} className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{country}</h2>
            <div className="space-y-6">
              {items.map((art, idx) => (
                <article key={`${country}-${idx}`} className="border-b pb-4 last:border-none">
                  <a
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xl font-medium text-blue-600 hover:underline"
                  >
                    {art.title}
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    {art.date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="mt-2 text-gray-800">{art.snippet}</p>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}