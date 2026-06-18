import type { Metadata } from "next";
import { NewsProvider } from './contexts/NewsContext'
import { Header } from './components/Header'
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
    <html lang="en" className="dark">
      <body
        className="bg-[#0a0a0a] text-white"
        style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
      >
        <NewsProvider>
          <Header />
          <main>{children}</main>
        </NewsProvider>
      </body>
    </html>
  );
}