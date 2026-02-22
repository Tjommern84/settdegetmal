import Link from 'next/link';
import type { Goal } from '../lib/domain';
import { Card } from './ui/Card';

const cityDisplayNames: Record<string, string> = {
  oslo: 'Oslo',
  bærum: 'Bærum',
  drammen: 'Drammen',
  lillestrøm: 'Lillestrøm',
  asker: 'Asker',
  bergen: 'Bergen',
  trondheim: 'Trondheim',
  stavanger: 'Stavanger',
  kristiansand: 'Kristiansand',
  tromsø: 'Tromsø',
};

const goalLabels: Record<Goal, string> = {
  weight_loss: 'Vektnedgang',
  strength: 'Styrke',
  mobility: 'Mobilitet',
  rehab: 'Rehab',
  endurance: 'Utholdenhet',
  start: 'Komme i gang',
};

const goalSlugs: Record<Goal, string> = {
  weight_loss: 'vektnedgang',
  strength: 'styrke',
  mobility: 'mobilitet',
  rehab: 'rehab',
  endurance: 'utholdenhet',
  start: 'nybegynner',
};

const defaultGoals: Goal[] = ['strength', 'weight_loss', 'start', 'mobility', 'endurance'];

type LocalHighlightsProps = {
  cityKey: string;
  cityLabel?: string;
  title?: string;
  goals?: Goal[];
  className?: string;
};

export default function LocalHighlights({
  cityKey,
  cityLabel,
  title,
  goals,
  className,
}: LocalHighlightsProps) {
  const cityName = cityLabel ?? cityDisplayNames[cityKey] ?? cityKey;
  const items = (goals && goals.length > 0 ? goals : defaultGoals)
    .filter((goal) => goalSlugs[goal])
    .slice(0, 5);

  if (!cityKey || items.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title ?? `Populær trening i ${cityName}`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((goal) => (
          <Link
            key={`${cityKey}-${goal}`}
            href={`/trening/${cityKey}/${goalSlugs[goal]}`}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            Trening for {goalLabels[goal]} i {cityName}
          </Link>
        ))}
      </div>
    </Card>
  );
}
