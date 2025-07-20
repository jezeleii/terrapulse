import React from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { NewsSearch } from "./NewsSearch"; 
import { newsData } from '@/prisma/seed';

export function Header({ className= ''}) {
  return (
      <Card
      className={`relative h-96 w-full shadow-none
        ${className}`}
      style={{
          /* Combined top and bottom flattened arches */
          background:
           // 'radial-gradient(ellipse 100% 40% at top center, rgb(79, 253, 212,0.9) 40%, var(--color-background) 100%), ' +
            'radial-gradient(ellipse 110% 30% at bottom center, var(--color-background) 50%, transparent 90%), ' +
            'radial-gradient(ellipse 70% 40% at bottom center, var(--color-primary) 70%, var(--color-background) 100%)',
        }}>
      <CardContent className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pb-15">
        <div className="flex flex-col items-center w-full">
          <div className="mb-2">
            <h1 className="text-6xl font-extrabold text-[var(--color-primary)]">terrapulse</h1>
            <p className="mt-2 text-xl text-[var(--color-primary)]/50">
              Sustainable Energy News, Right at Your Fingertips
            </p>
        </div>
        <div className="w-full max-w-2xl">
          <NewsSearch 
            newsItems={newsData}
            onSearch={(results) => {
              console.log(results)
            }}
            className="
              p-4
              rounded-full
            "
          />
        </div>
        </div>
      </CardContent>
    </Card>
  );
}