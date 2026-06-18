'use client';
import { useState, useMemo, useEffect } from 'react';
import { NewsItem } from '@/prisma/seed';

interface NewsSearchProps {
  newsItems: NewsItem[];
  onSearch: (results: NewsItem[]) => void;
  className?: string;
}

export const NewsSearch = ({ newsItems, onSearch, className }: NewsSearchProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focused, setFocused] = useState(false);

  const searchSuggestions = useMemo(() => {
    const allTags = Array.from(new Set(newsItems.flatMap(item => item.tags)));
    const allCountries = Array.from(new Set(newsItems.flatMap(item => item.countries)));
    return [...allTags, ...allCountries, 'carbon credits', 'emissions trading', 'net-zero'];
  }, [newsItems]);

  useEffect(() => {
    if (query.length > 0) {
      const filtered = searchSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 6));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, searchSuggestions]);

  const handleSearch = () => {
    const results = query ? newsItems.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.snippet.toLowerCase().includes(query.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
      item.countries.some(country => country.toLowerCase().includes(query.toLowerCase()))
    ) : newsItems;
    onSearch(results);
    setShowSuggestions(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col gap-0">
        <div className="relative">
          <div className={`
            flex items-center gap-2
            ${showSuggestions && suggestions.length > 0 ? 'rounded-t-3xl' : 'rounded-full'}
            bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl
            border-2 border-[var(--color-primary)]/60
            transition-all duration-300
            ${focused ? 'border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20' : ''}
            ${showSuggestions && suggestions.length > 0 ? 'border-b-0' : ''}
          `}>
            <svg className="w-5 h-5 text-[var(--color-primary)]/60 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            <input
              type="text"
              className="
                w-full
                px-2
                py-3
                bg-transparent
                text-white
                placeholder-white/40
                focus:outline-none
                border-none
                text-base
              "
              placeholder="Search by tag, country, or keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => {
                setFocused(true);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                setFocused(false);
                setTimeout(() => setShowSuggestions(false), 200);
              }}
            />

            <button
              onClick={handleSearch}
              className="
                py-2
                px-6
                mr-2
                text-sm
                font-semibold
                rounded-full
                bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/80
                text-black
                hover:shadow-lg hover:shadow-[var(--color-primary)]/40
                hover:scale-105
                transition-all
                border-none
                focus:outline-none
                active:scale-95
              "
            >
              Search
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="
              absolute
              top-full
              left-0
              right-0
              bg-gradient-to-b from-white/10 to-white/5
              backdrop-blur-xl
              rounded-b-3xl
              border-2
              border-t-0
              border-[var(--color-primary)]/60
              shadow-2xl
              z-20
              max-h-64
              overflow-y-auto
              scrollbar-thin scrollbar-thumb-[var(--color-primary)]/40 scrollbar-track-transparent
            ">
              <ul className="py-2">
                {suggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="
                      px-6
                      py-3
                      hover:bg-[var(--color-primary)]/20
                      text-white/80
                      transition-all
                      duration-150
                      cursor-pointer
                      border-l-3 border-transparent hover:border-[var(--color-primary)]
                      text-sm
                    "
                    onMouseDown={() => {
                      setQuery(suggestion);
                      handleSearch();
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--color-primary)]/60">•</span>
                      {suggestion}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {query.length > 0 && suggestions.length === 0 && (
          <div className="
            mt-3
            bg-gradient-to-r from-white/5 to-white/10
            backdrop-blur-xl
            rounded-2xl
            p-4
            text-white/60
            text-center
            border border-[var(--color-primary)]/30
            text-sm
          ">
            No results found for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
};