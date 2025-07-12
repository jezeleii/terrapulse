import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function Header() {
  return (
      <Card
      className="relative h-96 w-full shadow-none overflow-hidden"
      style={{
          /* Combined top and bottom flattened arches */
          background:
           // 'radial-gradient(ellipse 100% 40% at top center, rgb(79, 253, 212,0.9) 40%, var(--color-background) 100%), ' +
            'radial-gradient(ellipse 110% 30% at bottom center, var(--color-background) 50%, transparent 90%), ' +
            'radial-gradient(ellipse 70% 40% at bottom center, var(--color-primary) 70%, var(--color-background) 100%)',
        }}>
      <CardContent className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 pb-15">
        <h1 className="text-6xl font-extrabold text-[var(--color-primary)]">terrapulse</h1>
        <p className="mt-2 text-xl text-[var(--color-primary)]/50">
          Sustainable Energy News, Right at Your Fingertips
        </p>
      </CardContent>
    </Card>
  );
}