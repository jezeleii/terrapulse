import prisma from '@/lib/prisma';

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

export const revalidate = 3600;

export default async function ArticlesByCountryPage() {
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

  const grouped = articles.reduce<GroupedArticles>((map, article) => {
    const keys = article.countries.length ? article.countries : ['Uncategorized'];
    keys.forEach(country => {
      if (!map[country]) map[country] = [];
      map[country].push(article);
    });
    return map;
  }, {});

  const totalArticles = articles.length;
  const countryCount = Object.keys(grouped).length;

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
    >
      {/* Stats bar */}
      <div className="flex shrink-0 border-b border-[#7ef6e0]/15 bg-[#0c0c0c]">
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">SIGNAL REPORTS</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">{totalArticles}</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]/70">ARTICLES</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">COVERAGE</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">{countryCount}</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]/70">COUNTRIES</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">DATA SOURCE</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-[#7ef6e0]">DB</span>
            <span className="text-[11px] font-bold tracking-widest text-white/40">INDEXED</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.15em] text-white">
            SIGNAL REPORTS
          </h1>
          <p className="text-[10px] text-[#7ef6e0]/35 tracking-wider mt-1">
            Database Index: ACTIVE&nbsp;&nbsp;|&nbsp;&nbsp;Grouped by Region&nbsp;&nbsp;|&nbsp;&nbsp;Revalidation: 1H
          </p>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-8 text-center">
            <div className="text-[10px] text-[#7ef6e0]/40 tracking-[0.2em] mb-2">
              NO SIGNAL DATA AVAILABLE
            </div>
            <div className="text-[9px] text-white/30 tracking-wider">
              Run the seed script to populate the database.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([country, items]) => (
              <section key={country}>
                {/* Country header */}
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-[#7ef6e0]/15">
                  <span className="text-[9px] font-bold text-[#7ef6e0] tracking-[0.2em]">
                    {country.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-white/25 tracking-widest">
                    {items.length} SIGNAL{items.length !== 1 ? 'S' : ''}
                  </span>
                </div>

                {/* Articles */}
                <div className="space-y-2">
                  {items.map((art, idx) => (
                    <div
                      key={`${country}-${idx}`}
                      className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4 hover:border-[#7ef6e0]/35 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">
                            {art.date.toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }).toUpperCase()}
                          </div>
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-black text-white hover:text-[#7ef6e0] transition-colors leading-snug block mb-2"
                          >
                            {art.title}
                          </a>
                          <p className="text-[11px] text-white/55 leading-relaxed">{art.snippet}</p>
                        </div>
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[9px] font-bold text-[#7ef6e0]/50 hover:text-[#7ef6e0] tracking-widest transition-colors"
                        >
                          READ →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
