import { NextResponse } from 'next/server';
import { getAvailability } from '../../dashboard/actions';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const serviceId = url.searchParams.get('serviceId') ?? '';
  if (!serviceId) {
    return NextResponse.json([], { status: 400 });
  }

  const availability = await getAvailability(serviceId);
  return NextResponse.json(availability);
}
