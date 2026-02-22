import './globals.css';
import type { ReactNode } from 'react';
import ConsentGate from '../components/ConsentGate';
import TopNav from '../components/TopNav';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Sett deg et mål',
  description: 'Matching av treningstilbydere og kunder',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="no">
      <body className="min-h-screen bg-slate-50 text-slate-900">
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
