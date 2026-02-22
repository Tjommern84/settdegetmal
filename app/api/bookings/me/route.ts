import { NextResponse } from 'next/server';
import { getMyBookings } from '../../../actions/bookings';

export async function GET(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  if (!token) {
    return NextResponse.json({ customerBookings: [], providerBookings: [] }, { status: 401 });
  }

  const payload = await getMyBookings(token);
  return NextResponse.json(payload);
}
