import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '../../actions/recommendations';

export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  if (!token) {
    return NextResponse.json({ recommendations: [], locationLabel: null });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const parsedLimit = Number(limitParam);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(15, parsedLimit))
    : 5;
  const suggestions = await getRecommendations(token, limit);
  return NextResponse.json(suggestions);
}
