import { NextRequest, NextResponse } from 'next/server';
import { waitForNominatimRateLimit } from '@/server/connectors/nominatim';
import { parseCoordinate, PRIVATE_NO_STORE_HEADERS, readJsonWithByteLimit } from '@/server/http';

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams;
  const path = input.get('path');
  if (path !== 'search' && path !== 'reverse') {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1' });
  if (path === 'search') {
    const query = input.get('q')?.trim() ?? '';
    if (query.length < 2 || query.length > 200) {
      return NextResponse.json({ error: 'Search query must contain 2 to 200 characters.' }, { status: 400 });
    }
    params.set('q', query);
    params.set('countrycodes', 'in');
    params.set('limit', '15');
  } else {
    const lat = parseCoordinate(input.get('lat'), 90);
    const lon = parseCoordinate(input.get('lon'), 180);
    if (lat === null || lon === null) {
      return NextResponse.json({ error: 'Invalid lat or lon parameters' }, { status: 400 });
    }
    params.set('lat', String(lat));
    params.set('lon', String(lon));
    params.set('zoom', '14');
    params.set('extratags', '1');
  }

  try {
    await waitForNominatimRateLimit();
  } catch {
    return NextResponse.json({ error: 'Nominatim is busy. Retry shortly.' }, { status: 429 });
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/${path}?${params}`, {
      headers: {
        'User-Agent': 'BaseraIndiaMap/1.0 (hello@baseraindia.com)',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(8_000)]),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Nominatim API error' }, { status: res.status });
    }

    const data = await readJsonWithByteLimit(res, 2_000_000);
    return NextResponse.json(data, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from Nominatim' }, { status: 502 });
  }
}
