import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terrapulse Map",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background text-text">
        {/* Essential for proper routing */}
        <main className="h-full">
          {children}
        </main>
      </body>
    </html>
  );
}