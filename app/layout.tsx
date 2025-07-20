import type { Metadata } from "next";
import { NewsProvider } from './contexts/NewsContext'
import "./globals.css";

export const metadata: Metadata = {
  title: "Terrapulse",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background text-text">
        <main className="h-full">
          <NewsProvider>
             {children}
          </NewsProvider>
        </main>
      </body>
    </html>
  );
}