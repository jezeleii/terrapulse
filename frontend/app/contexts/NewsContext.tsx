// 'use client' directive for Next.js client component
'use client';

import React, { createContext, ReactNode, useState, useMemo } from 'react';
import { NewsItem } from '@/prisma/seed';
import seed from '@/prisma/seed';

// Define the shape of the context
export type NewsContextType = {
  newsData: NewsItem[];
  getArticles: (country: string) => NewsItem[];
};

// Create context with default empty implementations
export const newsContext = createContext<NewsContextType>({
  newsData: [],
  getArticles: () => []
});

// Props for the provider
interface NewsProviderProps {
  children: ReactNode;
  initialNewsData?: NewsItem[];
}

// NewsProvider component implementation
export const NewsProvider: React.FC<NewsProviderProps> = ({ children, initialNewsData }) => {
  // Use seed data if no initial data is passed
  const [newsData] = useState<NewsItem[]>(
    initialNewsData && initialNewsData.length > 0 ? initialNewsData : seed.newsData
  );

  // Memoise filtered articles by country for performance
  const getArticles = useMemo(
    () => (country: string) =>
      newsData.filter(item =>
        item.countries.map(c => c.toLowerCase()).includes(country.toLowerCase())
      ),
    [newsData]
  );

  return (
    <newsContext.Provider value={{ newsData, getArticles }}>
      {children}
    </newsContext.Provider>
  );
};

// Usage example in _app.tsx:
// import { NewsProvider } from '@/path/to/newscontext';
//
// function App({ Component, pageProps }) {
//   return (
//     <NewsProvider>
//       <Component {...pageProps} />
//     </NewsProvider>
//   );
// }
//
// export default App;
