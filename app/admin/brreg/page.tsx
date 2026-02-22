import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServiceSupabase } from '../../../lib/serviceSupabase';
import { isAdminByEmail } from '../../../lib/adminHelper';
import { redirect } from 'next/navigation';
import { Card } from '../../../components/ui/Card';
import { container } from '../../../lib/ui';
import { ENABLE_ADMIN } from '../../../lib/featureFlags';

export default async function BrregAdminPage({
  searchParams,
}: {
  searchParams: { category?: string; verified?: string; page?: string };
}) {
  // Auth check
  if (!ENABLE_ADMIN) {
    redirect('/');
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();

  if (!session?.access_token) {
    redirect('/');
  }

  const adminOk = await isAdminByEmail(session.access_token);
  if (!adminOk) {
    redirect('/');
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return <div>Database not configured</div>;
  }

  // Type definitions for Supabase results
  type BrregEntity = {
    orgnr: string;
    navn: string;
    category: string | null;
    naeringskode1_kode: string | null;
    antall_ansatte: number | null;
    verified: boolean;
    quality_score: number;
    relevance_score: number;
    forretningsadresse_adresse: string[] | null;
    forretningsadresse_postnummer: string | null;
    forretningsadresse_poststed: string | null;
  };

  type ImportLog = {
    id: string;
    status: string;
    started_at: string;
    total_imported: number | null;
  };

  const page = parseInt(searchParams.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('brreg_entities')
    .select('*', { count: 'exact' })
    .order('relevance_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (searchParams.category && searchParams.category !== 'all') {
    query = query.eq('category', searchParams.category);
  }

  if (searchParams.verified === 'true') {
    query = query.eq('verified', true);
  } else if (searchParams.verified === 'false') {
    query = query.eq('verified', false);
  }

  const { data: entities, count, error } = await query as { data: BrregEntity[] | null; count: number | null; error: any };

  if (error) {
    return <div>Error loading data: {error.message}</div>;
  }

  // Get import logs
  const { data: logs } = await supabase
    .from('brreg_import_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5) as { data: ImportLog[] | null };

  // Get stats
  const { data: stats } = await supabase.from('brreg_entities').select('category', { count: 'exact' }) as { data: { category: string | null }[] | null };

  const categoryStats = (stats || []).reduce(
    (acc, row) => {
      const cat = row.category || 'uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalPages = count ? Math.ceil(count / limit) : 0;

  return (
    <main className={`${container} py-12`}>
      <h1 className="text-3xl font-semibold">Brønnøysund Data Admin</h1>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-sm text-slate-500">Total Entities</div>
          <div className="mt-2 text-3xl font-semibold">{count?.toLocaleString() || 0}</div>
        </Card>
        {Object.entries(categoryStats)
          .slice(0, 3)
          .map(([category, count]) => (
            <Card key={category}>
              <div className="text-sm text-slate-500">{category}</div>
              <div className="mt-2 text-3xl font-semibold">{count}</div>
            </Card>
          ))}
      </div>

      {/* Import logs */}
      {logs && logs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Recent Imports</h2>
          <div className="mt-4 space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{log.status}</span>
                    {' - '}
                    {new Date(log.started_at).toLocaleString()}
                  </div>
                  <div className="text-slate-600">
                    {log.total_imported?.toLocaleString()} imported
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-8 flex gap-4">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2"
          defaultValue={searchParams.category || 'all'}
          onChange={(e) => {
            const url = new URL(window.location.href);
            url.searchParams.set('category', e.target.value);
            window.location.href = url.toString();
          }}
        >
          <option value="all">All Categories</option>
          {Object.keys(categoryStats).map((cat) => (
            <option key={cat} value={cat}>
              {cat} ({categoryStats[cat]})
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-slate-300 px-3 py-2"
          defaultValue={searchParams.verified || 'all'}
          onChange={(e) => {
            const url = new URL(window.location.href);
            url.searchParams.set('verified', e.target.value);
            window.location.href = url.toString();
          }}
        >
          <option value="all">All</option>
          <option value="true">Verified</option>
          <option value="false">Not Verified</option>
        </select>
      </div>

      {/* Entity list */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold">
          Entities ({count?.toLocaleString() || 0})
        </h2>
        <div className="mt-4 space-y-3">
          {entities?.map((entity) => (
            <Card key={entity.orgnr} className="text-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900">{entity.navn}</h3>
                    {entity.verified && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Orgnr: {entity.orgnr}</div>
                  <div className="mt-2 flex gap-4 text-xs text-slate-600">
                    <span>Category: {entity.category || 'none'}</span>
                    <span>NACE: {entity.naeringskode1_kode}</span>
                    <span>Employees: {entity.antall_ansatte || 'N/A'}</span>
                  </div>
                  {entity.forretningsadresse_adresse && (
                    <div className="mt-1 text-xs text-slate-500">
                      {entity.forretningsadresse_adresse.join(' ')},{' '}
                      {entity.forretningsadresse_postnummer} {entity.forretningsadresse_poststed}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Quality</div>
                  <div className="text-lg font-semibold">{entity.quality_score}/100</div>
                  <div className="text-xs text-slate-500">Relevance</div>
                  <div className="text-lg font-semibold">{entity.relevance_score}/100</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {page > 1 && (
              <a
                href={`?page=${page - 1}${searchParams.category ? `&category=${searchParams.category}` : ''}`}
                className="rounded-lg border px-4 py-2 hover:bg-slate-50"
              >
                Previous
              </a>
            )}
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`?page=${page + 1}${searchParams.category ? `&category=${searchParams.category}` : ''}`}
                className="rounded-lg border px-4 py-2 hover:bg-slate-50"
              >
                Next
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
