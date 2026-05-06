import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ data: [] });
  }

  try {
    // Deezer API'ye sunucu üzerinden istek atıyoruz ki tarayıcı (CORS) hataları almayalım.
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
    const json = await res.json();
    
    // Bize sadece lazım olan bilgileri filtreleyip gönderelim (Tasarruf ve hız)
    const results = json.data.map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      preview: track.preview, // 30 saniyelik ses dosyası
      cover: track.album.cover_small // Küçük albüm kapağı
    }));

    return NextResponse.json({ data: results });
  } catch (error) {
    return NextResponse.json({ error: 'Arama hatası' }, { status: 500 });
  }
}
