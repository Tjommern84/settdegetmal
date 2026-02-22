'use server';

import { NextRequest, NextResponse } from 'next/server';
import {
  adminUpdateServiceCuration,
  adminUpsertCategory,
  getCategories,
  getFeaturedServices,
  getServicesByCategory,
} from '../../actions/curation';

const parseAccessToken = (request: NextRequest): string | null => {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  if (type === 'categories') {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  }
  if (type === 'featured') {
    const featured = await getFeaturedServices();
    return NextResponse.json({ featured });
  }
  if (type === 'category' && request.nextUrl.searchParams.has('id')) {
    const categoryId = request.nextUrl.searchParams.get('id') as string;
    const q = request.nextUrl.searchParams.get('q') ?? undefined;
    const services = await getServicesByCategory({ categoryId, q });
    return NextResponse.json({ services });
  }
  return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const accessToken = parseAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: 'Manglende tilgang.' }, { status: 401 });
  }
  const { action } = await request.json();
  if (action === 'update-service') {
    const { serviceId, isFeatured, featuredRank, categories } = await request.json();
    const result = await adminUpdateServiceCuration(accessToken, {
      serviceId,
      isFeatured,
      featuredRank,
      categories,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (action === 'upsert-category') {
    const { id, name, description } = await request.json();
    const result = await adminUpsertCategory(accessToken, { id, name, description });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, message: 'Ugyldig handling.' }, { status: 400 });
}
