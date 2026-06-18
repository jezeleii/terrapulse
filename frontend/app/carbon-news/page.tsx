'use client';
import React, { useState, useEffect } from 'react';

interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  countries: string[];
  tags: string[];
  date: string;
  analysis?: {
    sentiment: string;
    impact: string;
    keyMetrics: string[];
  };
}

const TOPICS = [
  'carbon credit markets',
  'emissions trading systems',
  'carbon offset projects',
  'net-zero commitments',
  'carbon pricing policies',
];

export default function CarbonNewsPage() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('carbon credit markets');

  const fetchNews = async (topic: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?topic=${encodeURIComponent(topic)}&analyze=true`);
      const data = await res.json() as NewsItem[];
      setArticles(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(selectedTopic);
  }, [selectedTopic]);

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
    >
      {/* Stats bar */}
      <div className="flex shrink-0 border-b border-[#7ef6e0]/15 bg-[#0c0c0c]">
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">SIGNAL FEED</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">LIVE</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]">AI ANALYSIS</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">ARTICLES LOADED</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">{articles.length}</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]/70">ITEMS</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">STATUS</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-black tracking-tight ${loading ? 'text-yellow-400' : 'text-[#7ef6e0]'}`}>
              {loading ? 'LOADING' : 'READY'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.15em] text-white">
            CARBON MARKETS INTELLIGENCE
          </h1>
          <p className="text-[10px] text-[#7ef6e0]/35 tracking-wider mt-1">
            Real-Time AI Analysis&nbsp;&nbsp;|&nbsp;&nbsp;Gemini Signal Engine: ACTIVE&nbsp;&nbsp;|&nbsp;&nbsp;Topic: {selectedTopic.toUpperCase()}
          </p>
        </div>

        {/* Topic filters */}
        <div>
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-2">SELECT TOPIC</div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                className={`text-[9px] px-3 py-1.5 tracking-widest font-bold transition-colors ${
                  selectedTopic === topic
                    ? 'bg-[#7ef6e0] text-[#0a0a0a]'
                    : 'border border-[#7ef6e0]/30 text-[#7ef6e0]/55 hover:text-[#7ef6e0] bg-black/60'
                }`}
              >
                {topic.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-8 flex flex-col items-center gap-3">
            <div className="text-[10px] text-[#7ef6e0]/60 tracking-[0.2em] animate-pulse">
              ANALYZING CARBON MARKET SIGNALS...
            </div>
            <div className="h-px w-48 bg-[#0a0a0a] overflow-hidden">
              <div className="h-full bg-[#7ef6e0]/40 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Articles */}
        {!loading && articles.length > 0 && (
          <div className="space-y-3">
            <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">
              SIGNAL REPORTS — {articles.length} ITEMS
            </div>
            {articles.map((article, idx) => (
              <div
                key={idx}
                className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4 hover:border-[#7ef6e0]/35 transition-colors"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">
                      {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}
                      {article.countries.length > 0 && (
                        <>&nbsp;&nbsp;|&nbsp;&nbsp;{article.countries.join(', ').toUpperCase()}</>
                      )}
                    </div>
                    <h3 className="text-sm font-black tracking-tight text-white leading-snug">
                      {article.title}
                    </h3>
                  </div>
                  {article.analysis && (
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-[9px] px-2 py-0.5 font-bold tracking-widest ${
                        article.analysis.sentiment === 'positive'
                          ? 'bg-[#7ef6e0]/15 text-[#7ef6e0]'
                          : article.analysis.sentiment === 'negative'
                          ? 'bg-red-400/15 text-red-400'
                          : 'bg-yellow-400/15 text-yellow-400'
                      }`}>
                        {article.analysis.sentiment.toUpperCase()}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 font-bold tracking-widest border ${
                        article.analysis.impact === 'high'
                          ? 'border-[#7ef6e0]/40 text-[#7ef6e0]/70'
                          : article.analysis.impact === 'medium'
                          ? 'border-yellow-400/40 text-yellow-400/70'
                          : 'border-white/20 text-white/30'
                      }`}>
                        {article.analysis.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-white/60 leading-relaxed mb-3">
                  {article.snippet}
                </p>

                {/* Tags + metrics row */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#7ef6e0]/10">
                  <div className="flex flex-wrap gap-1.5">
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-2 py-0.5 border border-[#7ef6e0]/20 text-[#7ef6e0]/50 tracking-widest"
                      >
                        {tag.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {article.analysis && (
                      <span className="text-[9px] text-white/30 tracking-widest">
                        {article.analysis.keyMetrics.length} METRICS
                      </span>
                    )}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-bold text-[#7ef6e0]/60 hover:text-[#7ef6e0] tracking-widest transition-colors"
                    >
                      READ →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-8 text-center">
            <div className="text-[10px] text-[#7ef6e0]/40 tracking-[0.2em]">
              NO SIGNAL DATA — SELECT A TOPIC TO LOAD
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
