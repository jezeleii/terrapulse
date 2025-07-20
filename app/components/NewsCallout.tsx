// 'use client' directive for Next.js client component
'use client';

import React, { useContext, useEffect, useState } from 'react';
import { NewsItem } from '@/prisma/seed';
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

  const handleClick = () => setClicked(true);

  const handleClose = () => {
    setClicked(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setClicked(false);
    }
  }, [isOpen]);

  // For debugging
  useEffect(() => {
    console.log('Current articles for', country, articles);
  }, [articles, country]);

  const translateClass = clicked || isOpen
    ? 'translate-x-0'
    : side === 'left'
    ? '-translate-x-full'
    : 'translate-x-full';

  const positionClass = side === 'left' ? 'left-0' : 'right-0';
  const roundedClass = side === 'left' ? 'rounded-r-lg' : 'rounded-l-lg';

  return (
    <div
      className={`
        fixed
        top-0
        bottom-0
        ${positionClass}
        w-1/3
        max-w-sm
        p-4
        flex
        flex-col
        bg-black/70
        bg-[radial-gradient(circle_at_bottom_right,var(--color-primary)_0%,transparent_0%)]
        backdrop-blur-sm
        ${roundedClass}
        shadow-[0_0_20px_rgba(0,255,200,0.1)]
        z-50
        transform
        transition-transform
        duration-300
        ${translateClass}
      `}
      onMouseEnter={() => isOpen && !clicked && setClicked(true)}
      onMouseLeave={() => !clicked && onClose()}
    >
      <header className="py-4 border-b border-[var(--color-primary)] flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[var(--color-primary)]">
          Latest News in {country}
        </h2>
        <button onClick={handleClose} aria-label="Close" className="text-gray-500 hover:text-gray-700">
          ×
        </button>
      </header>
      <main onClick={handleClick} className="py-4 overflow-y-auto flex-1">
        {articles.length > 0 ? (
          <div className="
            p-3
            rounded-lg
            border-[var(--color-primary)] 
            border-b-5
        ">
            {articles.map(article => (
              <article
                key={`${article.title}-${article.date.toISOString()}`}
                className="
                    pb-2
                    last:border-0
                "
              >
                <h3 className="font-medium text-[var(--color-primary)]">{article.title}</h3>
                <p className="text-sm text-gray-300 mt-1">{article.snippet}</p>
                {article.tags && article.tags.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {article.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-1 rounded-full bg-[var(--color-primary)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
                >
                  Read more →
                </a>
              </article>
            ))}
          </div>
        ) : (
          children || <p className="text-gray-400">No news available for {country}</p>
        )}
      </main>
    </div>
  );
}
