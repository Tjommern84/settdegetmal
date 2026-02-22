'use client';

import { useState } from 'react';
import Link from 'next/link';
import FeedbackModal from './FeedbackModal';
import { container } from '../lib/ui';

export default function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className={`${container} flex flex-col gap-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between`}>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} settdegetmal.no</p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            Gi feedback
          </button>
          <Link href="/personvern" className="hover:text-slate-900">
            Personvern
          </Link>
          <Link href="/vilkar" className="hover:text-slate-900">
            Vilkår
          </Link>
          <Link href="/cookies" className="hover:text-slate-900">
            Cookies
          </Link>
        </div>
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
