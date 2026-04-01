import './globals.css';
import type { ReactNode } from 'react';
import { Outfit, DM_Sans } from 'next/font/google';
import ConsentGate from '../components/ConsentGate';
import TopNav from '../components/TopNav';
import Footer from '../components/Footer';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500'],
  display: 'swap',
});

export const metadata = {
  title: 'Sett deg et mål',
  description: 'Matching av treningstilbydere og kunder',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="no" className={`${outfit.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#f7f4ef] font-sans text-slate-900">
        <div className="flex min-h-screen flex-col">
          <TopNav />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <ConsentGate />
      </body>
    </html>
  );
}
