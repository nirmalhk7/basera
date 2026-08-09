import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  
  const path = searchParams.get('path'); // 'search' or 'reverse'
  searchParams.delete('path');

  if (path !== 'search' && path !== 'reverse') {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const nominatimUrl = `https://nominatim.openstreetmap.org/${path}?${searchParams.toString()}`;

  try {
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'BaseraIndiaMap/1.0 (hello@baseraindia.com)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Nominatim API error' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('API Route fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch from Nominatim' }, { status: 500 });
  }
}
