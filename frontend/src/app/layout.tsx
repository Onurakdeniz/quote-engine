import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from '@/components/navigation';
import { Toaster } from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Price Quoter - DeFi Price Discovery",
  description: "Advanced price discovery and path visualization for DeFi tokens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
          <Navigation />
          <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-amber-100">
            <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              <span>
                API key not provided. The quote engine is using older cached data until live market data is configured.
              </span>
            </div>
          </div>
          <main className="flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
        </div>
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'bg-background text-foreground border border-border',
          }}
        />
      </body>
    </html>
  );
}
