import Link from 'next/link';
import AuthButton from './AuthButton';
import { container } from '../lib/ui';

export default function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className={`${container} flex h-16 items-center justify-between`}> 
        <Link href="/" className="text-sm font-semibold tracking-wide text-slate-900">
          settdegetmal.no
        </Link>
        <div className="flex items-center gap-2">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}


