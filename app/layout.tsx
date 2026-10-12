import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Press_Start_2P } from 'next/font/google';
const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], display: 'swap' });
// <body className={pixel.className}>


export const metadata: Metadata = {
  title: 'Pac-Man Online',
  description: 'Play Pac-Man and climb the leaderboard',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
