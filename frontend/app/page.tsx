"use client";
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { NewsFeed } from './components/NewsFeed';
import { useVcmDashboard } from './hooks/useVcmDashboard';
import type { MetricMode } from './components/analytics/types';

const GlobalProjectMap = dynamic(
  () => import('./components/analytics/GlobalProjectMap').then((m) => ({ default: m.GlobalProjectMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full bg-[#080808] animate-pulse border border-[#7ef6e0]/15" style={{ height: 520 }} />
    ),
  },
);

const AnalyticsDashboard = dynamic(
  () => import('./components/analytics/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })),
  { ssr: false },
);

const REGIONS   = ['GLOBAL', 'EUROPE', 'APAC', 'AMERICAS'] as const;
const CATEGORIES = ['COMPLIANCE', 'VOLUNTARY', 'DATA CENTRES'] as const;

const MARKET_CARDS = [
  { title: 'CARBON MARKETS',   metric: 'EUA: €74.22',    change: '▼ 1.24%',  sub: '24H',        positive: false, icon: '〜' },
  { title: 'ENERGY TRANSITION', metric: 'RE PPA: $62.40', change: '▲ +3.12%', sub: 'AVG INDEX',   positive: true,  icon: '⚡' },
  { title: 'DATA CENTRES',      metric: 'DEMAND: 82.4GW', change: '▲ +8.5%',  sub: 'YTD GROWTH',  positive: true,  icon: '◎' },
];

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function MapPage() {
  const [activeRegion, setActiveRegion]     = useState<string>('GLOBAL');
  const [activeCategory, setActiveCategory] = useState<string>('COMPLIANCE');
  const [mapMetric, setMapMetric]           = useState<MetricMode>('issued');

  const {
    projects,
    timeline,
    registryDistribution,
    registryTypeBreakdown,
    projectTypeBreakdown,
    totalIssued,
    totalRetired,
    activeProjects,
    loading,
    error,
  } = useVcmDashboard();

  const STATS = [
    { label: 'ACTIVE PROJECTS',  value: loading ? '—' : activeProjects.toLocaleString(), sub: 'VCM TRACKED',     color: 'text-[#7ef6e0]' },
    { label: 'CREDITS ISSUED',   value: loading ? '—' : fmt(totalIssued),                sub: 'TOTAL VOLUME',    color: 'text-[#7ef6e0]' },
    { label: 'CREDITS RETIRED',  value: loading ? '—' : fmt(totalRetired),               sub: 'TOTAL RETIRED',   color: 'text-[#7ef6e0]/70' },
  ];

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white flex flex-col"
      style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
    >
      {/* Stats bar */}
      <div className="flex shrink-0 border-b border-[#7ef6e0]/15 bg-[#0c0c0c]">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className={`flex-1 px-6 py-3 ${i < STATS.length - 1 ? 'border-r border-[#7ef6e0]/15' : ''}`}
          >
            <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">{s.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-white">{s.value}</span>
              <span className={`text-[11px] font-bold tracking-widest ${s.color}`}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 px-4 pt-4 pb-6 space-y-4">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-black tracking-[0.15em] text-white">
            GLOBAL CARBON MARKETS INTELLIGENCE
          </h1>
          <p className="text-[10px] text-[#7ef6e0]/35 tracking-wider mt-1">
            Continuous Monitoring Protocol: ACTIVE&nbsp;&nbsp;|&nbsp;&nbsp;Sources: 423 Signal Nodes&nbsp;&nbsp;|&nbsp;&nbsp;System Status: Optimal
          </p>
        </div>

        {/* VCM Project Map */}
        <div className="relative border border-[#7ef6e0]/20 overflow-hidden bg-[#080808]">
          {/* Top-left badge */}
          <div className="absolute top-3 left-3 z-20 flex gap-2 pointer-events-none">
            <span className="text-[9px] font-bold text-[#7ef6e0] border border-[#7ef6e0]/40 px-2 py-1 bg-black/70 tracking-[0.2em]">
              VCM PROJECT REGISTRY
            </span>
            <span className="text-[9px] font-bold text-[#0a0a0a] bg-[#7ef6e0] px-2 py-1 tracking-[0.2em] animate-pulse">
              ● {loading ? 'LOADING' : `${activeProjects.toLocaleString()} PROJECTS`}
            </span>
          </div>

          {/* Region + category filters — top-right */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
            <div className="flex gap-1">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRegion(r)}
                  className={`text-[9px] px-2 py-1 tracking-widest font-bold transition-colors ${
                    activeRegion === r
                      ? 'bg-[#7ef6e0] text-[#0a0a0a]'
                      : 'border border-[#7ef6e0]/30 text-[#7ef6e0]/55 hover:text-[#7ef6e0] bg-black/60'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`text-[9px] px-2 py-1 tracking-widest font-bold transition-colors ${
                    activeCategory === c
                      ? 'border border-[#7ef6e0] text-[#7ef6e0] bg-[#7ef6e0]/10'
                      : 'border border-[#7ef6e0]/20 text-[#7ef6e0]/35 hover:text-[#7ef6e0]/70 bg-black/60'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Metric toggle — bottom-left */}
          <div className="absolute bottom-3 left-3 z-20 flex gap-1">
            {(['issued', 'retired'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setMapMetric(mode)}
                className={`text-[9px] px-2 py-1 font-bold tracking-widest transition-colors ${
                  mapMetric === mode
                    ? 'bg-[#7ef6e0] text-[#0a0a0a]'
                    : 'border border-[#7ef6e0]/30 text-[#7ef6e0]/55 hover:text-[#7ef6e0] bg-black/60'
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <GlobalProjectMap projects={projects} variant="embedded" metric={mapMetric} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-400 tracking-wider">
            {error}
          </div>
        )}

        {/* News headlines */}
        <NewsFeed />

        {/* Market data cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MARKET_CARDS.map((card) => (
            <div
              key={card.title}
              className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4 hover:border-[#7ef6e0]/35 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] tracking-[0.2em] text-[#7ef6e0]/50">{card.title}</span>
                <span className="text-[#7ef6e0]/30 text-sm">{card.icon}</span>
              </div>
              <div className="text-lg font-black text-white tracking-tight">{card.metric}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-bold ${card.positive ? 'text-[#7ef6e0]' : 'text-red-400'}`}>
                  {card.change}
                </span>
                <span className="text-[10px] text-white/30 tracking-widest">{card.sub}</span>
              </div>
              <div className="mt-3 h-8 flex items-end gap-px opacity-40">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 ${card.positive ? 'bg-[#7ef6e0]' : 'bg-red-400'}`}
                    style={{ height: `${20 + Math.sin(i * 0.7 + (card.positive ? 0 : Math.PI)) * 12}px` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* VCM Analytics Dashboard */}
        {!loading && projects.length > 0 && (
          <AnalyticsDashboard
            timeline={timeline}
            registry={registryDistribution}
            registryTypes={registryTypeBreakdown}
            projectTypeBreakdown={projectTypeBreakdown}
            projects={projects}
          />
        )}
      </div>
    </div>
  );
}
