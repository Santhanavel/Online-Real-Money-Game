import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/Providers';

export const metadata: Metadata = {
  title: 'Rummy Royale - Multiplayer Indian Rummy Platform',
  description: 'Play Points Rummy, 101 Pool & 201 Pool with server-authoritative multiplayer gameplay.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            background-color: #37070D !important;
            color: #FFFFFF !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }
        `}} />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-[#37070D] text-slate-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
