import type { Provider } from '../lib/types';

export default function ProviderCard({
  provider,
  score,
}: {
  provider: Provider;
  score: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{provider.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{provider.description}</p>
        </div>
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
          Match {score}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {provider.serviceTypes.join(' / ')}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {provider.priceLevel}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {provider.locations.join(', ')}
        </span>
      </div>
      <div className="mt-3 text-xs text-slate-500">
        Tilbyr {provider.offersHome ? 'hjemmetrening' : 'kun senter'}
        {provider.offersGym && provider.offersHome ? ' og senter' : ''}
      </div>
    </div>
  );
}
