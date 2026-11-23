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
      <body className="antialiased min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
