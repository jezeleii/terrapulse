// scripts/fetchNews.js

require('dotenv').config();
console.log('API key is:', process.env.NEWS_API_KEY);

const axios = require('axios').create({
  baseURL: 'https://newsapi.org/v2',
  timeout: 10_000,
  headers: { 'X-Api-Key': process.env.NEWS_API_KEY }
});

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

const QUERY     = 'sustainable energy';
const PAGE_SIZE = 50;

async function main() {
  console.log('Fetching page 1…');

  let data;
  try {
    const resp = await axios.get('/everything', {
      params: {
        q:        QUERY,
        language: 'en',
        sortBy:   'publishedAt',
        pageSize: PAGE_SIZE,
        page:     1
      }
    });
    data = resp.data;
  } catch (err) {
    console.error('Axios error:', err.response?.status, err.response?.data || err.message);
    process.exit(1);
  }

  if (!Array.isArray(data.articles) || !data.articles.length) {
    console.log('No articles found.');
    return;
  }

  // ✅ Correctly loop over articles
  for (const a of data.articles) {
    const payload = {
      title:     a.title,
      snippet:   a.description || (a.content && a.content.slice(0, 200)) || '',
      url:       a.url,
      date:      new Date(a.publishedAt),
      tags:      ['sustainable', 'energy'],
      countries: []
    };

    try {
      await prisma.article.upsert({
        where:  { url: payload.url },
        create: payload,
        update: {
          snippet: payload.snippet,
          date:    payload.date
        }
      });
      console.log(`✅ Upserted: ${payload.title}`);
    } catch (dbErr) {
      console.error('Prisma upsert error for', payload.url, dbErr);
    }
  }

  console.log('Fetching and Upserting Completed.');
}

main()
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
