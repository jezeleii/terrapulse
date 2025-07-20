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

  const searchSuggestions = useMemo(() => {
    const allTags = Array.from(new Set(newsItems.flatMap(item => item.tags)));
    const allCountries = Array.from(new Set(newsItems.flatMap(item => item.countries)));
    return [...allTags, ...allCountries, 'sustainable', 'renewable', 'energy'];
  }, [newsItems]);

  useEffect(() => {
    if (query.length > 0) {
      const filtered = searchSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
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
        {/* Main search container - top part */}
        <div className="relative">
          <div className={`
            flex items-center
            ${showSuggestions && suggestions.length > 0 ? 'rounded-t-2xl' : 'rounded-full'}
            bg-black/30 backdrop-blur-md
            border-2 border-[var(--color-primary)]
            ${showSuggestions && suggestions.length > 0 ? 'border-b-0' : ''}
          `}>
            <input
              type="text"
              className="
                w-full
                px-6
                py-3
                bg-transparent
                text-white
                placeholder-gray-300
                focus:outline-none
                border-none
              "
              placeholder="Search news..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />

            <button
              onClick={handleSearch}
              className="
                py-2
                px-4
                mx-2
                text-sm
                rounded-full
                bg-[var(--color-primary)]/50
                text-black
                hover:bg-[var(--color-primary)]/90
                transition-colors
                border-none
                focus:outline-none
              "
            >
              Search
            </button>
          </div>

          {/* Suggestions dropdown - connected bottom part */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="
              absolute
              top-full
              left-0
              right-0
              bg-black/80
              backdrop-blur-lg
              rounded-b-2xl
              border-2
              border-t-0
              border-[var(--color-primary)]
              shadow-lg
              z-20
              max-h-60
              overflow-y-auto
              scrollbar-primary
            ">
              <ul className="pb-2"> {/* Added bottom padding */}
                {suggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="
                      px-6
                      py-3
                      hover:bg-[var(--color-primary)]/20
                      text-white/90
                      transition-colors
                      duration-200
                    "
                    onMouseDown={() => {
                      setQuery(suggestion);
                      handleSearch();
                    }}
                  >
                    {suggestion}
                  </li>
                ))}
                {/* Bottom spacer to complete rounded corners */}
                <div className="h-2 w-full"></div>
              </ul>
            </div>
          )}
        </div>

        {/* Empty state - shown when no results */}
        {query.length > 0 && suggestions.length === 0 && (
          <div className="
            mt-2
            bg-black/80
            backdrop-blur-lg
            rounded-2xl
            p-4
            text-white/70
            text-center
            border-2 border-[var(--color-primary)]/30
          ">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
};