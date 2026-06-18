'use client';
import React, { useEffect, useState } from 'react';

interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  countries: string[];
  tags: string[];
  date: string;
}

export function NewsFeed() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news?topic=carbon+credit+markets')
      .then((r) => r.json())
      .then((data: NewsItem[]) => setArticles(data.slice(0, 4)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-[0.2em] text-[#7ef6e0]/50">SIGNAL HEADLINES</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#7ef6e0] animate-pulse" />
        </div>
        <span className="text-[9px] text-[#7ef6e0]/25 tracking-widest">LIVE · AUTO-REFRESH</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-[#7ef6e0]/10 bg-[#0c0c0c] p-4 animate-pulse">
              <div className="h-2 bg-[#7ef6e0]/10 rounded mb-3 w-1/2" />
              <div className="h-3 bg-[#7ef6e0]/15 rounded mb-2" />
              <div className="h-3 bg-[#7ef6e0]/10 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {articles.map((article, idx) => (
            <a
              key={idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                group border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4
                hover:border-[#7ef6e0]/40 hover:bg-[#7ef6e0]/5
                transition-colors duration-200
              "
            >
              {/* Index + tags row */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-[#7ef6e0]/30 tracking-widest">
                  [{String(idx + 1).padStart(2, '0')}]
                </span>
                <div className="flex gap-1">
                  {article.tags.slice(0, 1).map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] px-1.5 py-0.5 border border-[#7ef6e0]/20 text-[#7ef6e0]/50 tracking-widest"
                    >
                      {tag.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Title */}
              <h4 className="text-[12px] font-bold text-white/85 group-hover:text-white line-clamp-2 leading-snug mb-2 tracking-tight">
                {article.title}
              </h4>

              {/* Snippet */}
              <p className="text-[10px] text-white/35 line-clamp-2 leading-relaxed mb-3">
                {article.snippet}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[#7ef6e0]/10">
                <span className="text-[9px] text-[#7ef6e0]/40 tracking-wider truncate">
                  {article.countries.slice(0, 2).join(' · ')}
                </span>
                <span className="text-[9px] text-[#7ef6e0]/25 group-hover:text-[#7ef6e0]/60 transition-colors shrink-0 ml-2">
                  ↗
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
