'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Intelligence Hub', href: '/',                   icon: '▦' },
  { label: 'Knowledge Graph',  href: '/knowledge-graph',    icon: '◈' },
  { label: 'Latest News',      href: '/carbon-news',        icon: '▤' },
  { label: 'Carbon Markets',   href: '/analytics/projects', icon: '≋' },
] as const;

const TICKER = [
  { symbol: 'EUA',  price: '€74.22', change: -1.2 },
  { symbol: 'ACCU', price: '$38.50', change:  0.4 },
  { symbol: 'CCA',  price: '$29.15', change:  2.1 },
  { symbol: 'RGGI', price: '$13.84', change: -0.8 },
  { symbol: 'NZU',  price: '$51.20', change:  1.5 },
];

export function Header({ className = '' }) {
  const pathname = usePathname();

  return (
    <header
      className={`bg-[#0a0a0a] border-b border-[#7ef6e0]/20 font-mono ${className}`}
      style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
    >
      <div className="flex items-stretch h-11">
        {/* Branding */}
        <div className="flex items-center px-4 border-r border-[#7ef6e0]/20 shrink-0">
          <div className="leading-tight">
            <div className="text-[9px] font-bold text-[#7ef6e0] tracking-[0.2em]">CLIMATE</div>
            <div className="text-[9px] font-bold text-[#7ef6e0] tracking-[0.2em]">INTELLIGENCE</div>
            <div className="text-[9px] font-bold text-[#7ef6e0] tracking-[0.2em]">TERMINAL</div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-stretch">
          {TABS.map(({ label, href, icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 text-[11px] tracking-wide border-r border-[#7ef6e0]/10 transition-colors flex items-center gap-2 ${
                  active
                    ? 'text-[#7ef6e0] bg-[#7ef6e0]/10 border-b-2 border-b-[#7ef6e0]'
                    : 'text-[#7ef6e0]/40 hover:text-[#7ef6e0]/70 hover:bg-[#7ef6e0]/5'
                }`}
              >
                <span className="text-[9px]">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Ticker */}
        <div className="flex-1 flex items-center justify-end overflow-hidden border-l border-[#7ef6e0]/15 ml-auto">
          {TICKER.map((t) => (
            <div
              key={t.symbol}
              className="flex items-center gap-1.5 px-3 border-r border-[#7ef6e0]/10 shrink-0"
            >
              <span className="text-[10px] text-white/40 tracking-widest">{t.symbol}</span>
              <span className="text-[11px] font-bold text-white tabular-nums">{t.price}</span>
              <span className={`text-[10px] tabular-nums ${t.change >= 0 ? 'text-[#7ef6e0]' : 'text-red-400'}`}>
                {t.change >= 0 ? '▲' : '▼'}{Math.abs(t.change)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
