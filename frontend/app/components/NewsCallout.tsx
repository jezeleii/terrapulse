'use client';

import React, { useContext, useEffect, useState } from 'react';
import { newsContext } from '../contexts/NewsContext';

interface NewsCalloutProps {
  country: string;
  side?: 'left' | 'right';
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export function NewsCallout({
  country,
  side = 'right',
  isOpen,
  onClose,
  children,
}: NewsCalloutProps) {
  const { getArticles } = useContext(newsContext);
  const articles = getArticles(country);

  const [clicked, setClicked] = useState(false);
  const [time, setTime] = useState('');

  const handleClick = () => setClicked(true);

  const handleClose = () => {
    setClicked(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) setClicked(false);
  }, [isOpen]);

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const translateClass =
    clicked || isOpen
      ? 'translate-x-0'
      : side === 'left'
      ? '-translate-x-full'
      : 'translate-x-full';

  const positionClass = side === 'left' ? 'left-0' : 'right-0';
  const innerBorderClass =
    side === 'left'
      ? 'border-r-2 border-r-[#7ef6e0]/40'
      : 'border-l-2 border-l-[#7ef6e0]/40';

  return (
    <div
      className={`
        fixed top-0 bottom-0 ${positionClass}
        w-80
        flex flex-col
        bg-[#0a0a0a]
        border border-[#7ef6e0]/15 ${innerBorderClass}
        z-50
        transform transition-transform duration-300
        ${translateClass}
      `}
      style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
      onMouseEnter={() => isOpen && !clicked && setClicked(true)}
      onMouseLeave={() => !clicked && onClose()}
    >
      {/* Chrome bar */}
      <div className="flex items-center px-3 py-1.5 border-b border-[#7ef6e0]/15 bg-[#7ef6e0]/5 shrink-0">
        <span className="text-[9px] text-[#7ef6e0]/60 tracking-[0.25em] flex-1">◈ COUNTRY INTELLIGENCE</span>
        <span className="flex items-center gap-1 text-[9px] text-[#7ef6e0]/50 tracking-[0.1em]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7ef6e0]/60" />
          LIVE
        </span>
      </div>

      {/* Header */}
      <header className="px-4 py-3 border-b border-[#7ef6e0]/15 flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[#7ef6e0] tracking-[0.2em] uppercase">
            {country}
          </h2>
          <p className="text-[9px] text-[#7ef6e0]/40 tracking-[0.25em] mt-1 uppercase">
            Latest Intelligence
          </p>
          <p className="text-[9px] text-white/25 tracking-[0.15em] mt-0.5">
            {articles.length} SIGNAL{articles.length !== 1 ? 'S' : ''} DETECTED
          </p>
        </div>
        <button
          onClick={handleClose}
          aria-label="Close"
          className="text-[9px] text-[#7ef6e0]/40 hover:text-[#7ef6e0] hover:bg-[#7ef6e0]/10 transition-colors px-2 py-1 border border-[#7ef6e0]/20 tracking-widest uppercase"
        >
          ESC
        </button>
      </header>

      {/* Content */}
      <main onClick={handleClick} className="overflow-y-auto flex-1 scrollbar-primary">
        {articles.length > 0 ? (
          <div className="divide-y divide-[#7ef6e0]/10">
            {articles.map((article, idx) => (
              <article
                key={`${article.title}-${article.date.toISOString()}`}
                className="px-4 py-3 hover:bg-[#7ef6e0]/5 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] text-[#7ef6e0]/40 tracking-widest uppercase">
                    {article.date
                      .toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                      .toUpperCase()}
                  </span>
                  <span className="flex-1 h-px bg-[#7ef6e0]/10" />
                  <span className="text-[9px] text-[#7ef6e0]/25 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="text-[12px] text-white leading-snug group-hover:text-[#7ef6e0] transition-colors tracking-wide">
                  {article.title}
                </h3>

                <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed line-clamp-2">
                  {article.snippet}
                </p>

                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {article.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 bg-[#7ef6e0]/10 text-[#7ef6e0]/70 tracking-widest uppercase border border-[#7ef6e0]/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[9px] text-[#7ef6e0]/40 hover:text-[#7ef6e0] tracking-widest uppercase transition-colors"
                >
                  → VIEW SIGNAL
                </a>
              </article>
            ))}
          </div>
        ) : (
          children || (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <span className="text-[#7ef6e0]/15 text-4xl mb-4">◈</span>
              <p className="text-[10px] text-[#7ef6e0]/30 tracking-[0.25em] uppercase">
                No signals detected
              </p>
              <p className="text-[9px] text-white/15 mt-1 tracking-[0.15em] uppercase">
                {country}
              </p>
              <div className="mt-5 w-12 h-px bg-[#7ef6e0]/10" />
            </div>
          )
        )}
      </main>

      {/* Status bar */}
      <div className="flex items-center px-3 py-1.5 border-t border-[#7ef6e0]/15 bg-[#7ef6e0]/5 shrink-0">
        <span className="text-[9px] text-[#7ef6e0]/25 tracking-[0.15em] uppercase flex-1">
          TERRAPULSE ◈ {country}
        </span>
        <span className="text-[9px] text-[#7ef6e0]/20 tabular-nums tracking-widest">
          {time}
        </span>
      </div>
    </div>
  );
}
