// scripts/fetchNews.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { newsData } from '@/prisma/seed';

const prisma = new PrismaClient();

async function seedMockNews(): Promise<void> {
  console.log('🌱 Seeding mock news data...');

  let successCount = 0;
  let errorCount = 0;

  for (const article of newsData) {
    try {
      await prisma.article.create({
        data: {
          title:   article.title,
          snippet: article.snippet,
          url:     article.url,
          date:    article.date,
          tags:    article.tags,
          countries: article.countries,
        },
      });
      successCount++;
      console.log(`✅ Created: ${article.title.slice(0, 40)}...`);
    } catch (err: any) {
      // Unique constraint violation: update instead
      if (err.code === 'P2002') {
        await prisma.article.update({
          where: { url: article.url },
          data: {
            title:   article.title,
            snippet: article.snippet,
            date:    article.date,
            tags:    article.tags,
            countries: article.countries,
          },
        });
        successCount++;
        console.log(`🔄 Updated: ${article.title.slice(0, 40)}...`);
      } else {
        errorCount++;
        console.error(`❌ Error: ${article.title.slice(0, 40)}...`, err.message);
      }
    }
  }

  console.log('\n📊 Seeding results:');
  console.log(`✔ Successfully processed: ${successCount}`);
  console.log(`✖ Errors: ${errorCount}`);
  console.log(`💾 Total articles now: ${await prisma.article.count()}`);
}

seedMockNews()
  .catch(err => {
    console.error('⛔ Unhandled error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🛑 Database connection closed');
  });


//API LOGIC 

// require('dotenv').config();
// const axios = require('axios');
// const { PrismaClient } = require('../generated/prisma');

// const prisma = new PrismaClient();

// const COUNTRIES = {
//   af: 'Afghanistan',
//   al: 'Albania',
//   dz: 'Algeria',
//   ad: 'Andorra',
//   ao: 'Angola',
//   ag: 'Antigua and Barbuda',
//   ar: 'Argentina',
//   am: 'Armenia',
//   au: 'Australia',
//   at: 'Austria',
//   az: 'Azerbaijan',
//   bs: 'Bahamas',
//   bh: 'Bahrain',
//   bd: 'Bangladesh',
//   bb: 'Barbados',
//   by: 'Belarus',
//   be: 'Belgium',
//   bz: 'Belize',
//   bj: 'Benin',
//   bt: 'Bhutan',
//   bo: 'Bolivia',
//   ba: 'Bosnia and Herzegovina',
//   bw: 'Botswana',
//   br: 'Brazil',
//   bn: 'Brunei',
//   bg: 'Bulgaria',
//   bf: 'Burkina Faso',
//   bi: 'Burundi',
//   cv: 'Cabo Verde',
//   kh: 'Cambodia',
//   cm: 'Cameroon',
//   ca: 'Canada',
//   cf: 'Central African Republic',
//   td: 'Chad',
//   cl: 'Chile',
//   cn: 'China',
//   co: 'Colombia',
//   km: 'Comoros',
//   cg: 'Congo',
//   cr: 'Costa Rica',
//   ci: "Côte d'Ivoire",
//   hr: 'Croatia',
//   cu: 'Cuba',
//   cy: 'Cyprus',
//   cz: 'Czech Republic',
//   cd: 'DR Congo',
//   dk: 'Denmark',
//   dj: 'Djibouti',
//   dm: 'Dominica',
//   do: 'Dominican Republic',
//   ec: 'Ecuador',
//   eg: 'Egypt',
//   sv: 'El Salvador',
//   gq: 'Equatorial Guinea',
//   er: 'Eritrea',
//   ee: 'Estonia',
//   sz: 'Eswatini',
//   et: 'Ethiopia',
//   fj: 'Fiji',
//   fi: 'Finland',
//   fr: 'France',
//   ga: 'Gabon',
//   gm: 'Gambia',
//   ge: 'Georgia',
//   de: 'Germany',
//   gh: 'Ghana',
//   gr: 'Greece',
//   gd: 'Grenada',
//   gt: 'Guatemala',
//   gn: 'Guinea',
//   gw: 'Guinea-Bissau',
//   gy: 'Guyana',
//   ht: 'Haiti',
//   hn: 'Honduras',
//   hu: 'Hungary',
//   is: 'Iceland',
//   in: 'India',
//   id: 'Indonesia',
//   ir: 'Iran',
//   iq: 'Iraq',
//   ie: 'Ireland',
//   il: 'Israel',
//   it: 'Italy',
//   jm: 'Jamaica',
//   jp: 'Japan',
//   jo: 'Jordan',
//   kz: 'Kazakhstan',
//   ke: 'Kenya',
//   ki: 'Kiribati',
//   kw: 'Kuwait',
//   kg: 'Kyrgyzstan',
//   la: 'Laos',
//   lv: 'Latvia',
//   lb: 'Lebanon',
//   ls: 'Lesotho',
//   lr: 'Liberia',
//   ly: 'Libya',
//   li: 'Liechtenstein',
//   lt: 'Lithuania',
//   lu: 'Luxembourg',
//   mg: 'Madagascar',
//   mw: 'Malawi',
//   my: 'Malaysia',
//   mv: 'Maldives',
//   ml: 'Mali',
//   mt: 'Malta',
//   mh: 'Marshall Islands',
//   mr: 'Mauritania',
//   mu: 'Mauritius',
//   mx: 'Mexico',
//   fm: 'Micronesia',
//   md: 'Moldova',
//   mc: 'Monaco',
//   mn: 'Mongolia',
//   me: 'Montenegro',
//   ma: 'Morocco',
//   mz: 'Mozambique',
//   mm: 'Myanmar',
//   na: 'Namibia',
//   nr: 'Nauru',
//   np: 'Nepal',
//   nl: 'Netherlands',
//   nz: 'New Zealand',
//   ni: 'Nicaragua',
//   ne: 'Niger',
//   ng: 'Nigeria',
//   kp: 'North Korea',
//   mk: 'North Macedonia',
//   no: 'Norway',
//   om: 'Oman',
//   pk: 'Pakistan',
//   pw: 'Palau',
//   pa: 'Panama',
//   pg: 'Papua New Guinea',
//   py: 'Paraguay',
//   pe: 'Peru',
//   ph: 'Philippines',
//   pl: 'Poland',
//   pt: 'Portugal',
//   qa: 'Qatar',
//   ro: 'Romania',
//   ru: 'Russia',
//   rw: 'Rwanda',
//   kn: 'Saint Kitts and Nevis',
//   lc: 'Saint Lucia',
//   vc: 'Saint Vincent and the Grenadines',
//   ws: 'Samoa',
//   sm: 'San Marino',
//   st: 'Sao Tome and Principe',
//   sa: 'Saudi Arabia',
//   sn: 'Senegal',
//   rs: 'Serbia',
//   sc: 'Seychelles',
//   sl: 'Sierra Leone',
//   sg: 'Singapore',
//   sk: 'Slovakia',
//   si: 'Slovenia',
//   sb: 'Solomon Islands',
//   so: 'Somalia',
//   za: 'South Africa',
//   kr: 'South Korea',
//   ss: 'South Sudan',
//   es: 'Spain',
//   lk: 'Sri Lanka',
//   sd: 'Sudan',
//   sr: 'Suriname',
//   se: 'Sweden',
//   ch: 'Switzerland',
//   sy: 'Syria',
//   tj: 'Tajikistan',
//   tz: 'Tanzania',
//   th: 'Thailand',
//   tl: 'Timor-Leste',
//   tg: 'Togo',
//   to: 'Tonga',
//   tt: 'Trinidad and Tobago',
//   tn: 'Tunisia',
//   tr: 'Turkey',
//   tm: 'Turkmenistan',
//   tv: 'Tuvalu',
//   ug: 'Uganda',
//   ua: 'Ukraine',
//   ae: 'United Arab Emirates',
//   gb: 'United Kingdom',
//   us: 'United States',
//   uy: 'Uruguay',
//   uz: 'Uzbekistan',
//   vu: 'Vanuatu',
//   va: 'Vatican City',
//   ve: 'Venezuela',
//   vn: 'Vietnam',
//   ye: 'Yemen',
//   zm: 'Zambia',
//   zw: 'Zimbabwe'
// };


// async function fetchNewsByCountry(countryCode = 'us', limit = 5) {
//   console.log(`⌛ Fetching ${limit} articles for ${COUNTRIES[countryCode]}...`);
  
//   try {
//     const response = await axios.get('https://newsapi.org/v2/top-headlines', {
//       params: {
//         q: 'sustainable energy',
//         country: countryCode,
//         pageSize: limit,
//         apiKey: process.env.NEWS_API_KEY,
//         sortBy: 'publishedAt'
//       }
//     });
    
//     console.log(`✅ Found ${response.data.articles.length} articles`);
//     return response.data.articles;
//   } catch (error) {
//     console.error(`❌ Failed to fetch news for ${countryCode}:`, error.message);
//     return [];
//   }
// }

// async function upsertArticle(article) {
//   const payload = {
//     title: article.title,
//     snippet: article.description || (article.content?.slice(0, 200) || 'No content'),
//     url: article.url,
//     date: new Date(article.publishedAt),
//     tags: ['sustainable', 'energy'],
//     countries: []
//   };

//   try {
//     const result = await prisma.article.upsert({
//       where: { url: article.url },
//       create: payload,
//       update: payload
//     });
//     console.log(`💾 Saved: ${article.title.slice(0, 50)}...`);
//     return result;
//   } catch (err) {
//     console.error(`🔥 Failed to save: ${article.title.slice(0, 50)}...`, err.message);
//     return null;
//   }
// }

// async function main() {
//   console.log('🚀 Starting news fetch process...');
//   console.log('🔑 API Key:', process.env.NEWS_API_KEY ? 'Exists' : 'Missing!');

//   try {
//     // Test database connection
//     await prisma.$connect();
//     console.log('🔌 Connected to database');

//     // Fetch and save news
//     const articles = await fetchNewsByCountry('us', 3); // Start with 3 for testing
//     for (const article of articles) {
//       await upsertArticle(article);
//     }

//     // Verify records were created
//     const count = await prisma.article.count();
//     console.log(`📊 Total articles in database: ${count}`);
//   } catch (error) {
//     console.error('💥 CRITICAL ERROR:', error);
//   } finally {
//     await prisma.$disconnect();
//     console.log('🛑 Database connection closed');
//   }
// }

// // Run the script immediately
// main().catch(err => {
//   console.error('⛔ Unhandled error in main:', err);
//   process.exit(1);
// });

// // Export for use in API routes if needed
// module.exports = {
//   fetchNewsByCountry,
//   upsertArticle,
//   COUNTRIES
// };