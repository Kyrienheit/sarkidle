import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'mixed';
  const excludeId = searchParams.get('exclude'); // Bir önceki şarkıyı tekrar verme

  try {
    const redisKey = `endless_playlist_${category}`;
    const playlist = await redis.get(redisKey) || [];

    if (playlist.length === 0) {
      return NextResponse.json({ error: `${category} playlisti boş. Admin panelden şarkı ekle.` }, { status: 404 });
    }

    // Önceki şarkıyı hariç tut (mümkünse)
    let pool = playlist;
    if (excludeId && playlist.length > 1) {
      pool = playlist.filter(item => String(item.id) !== String(excludeId));
    }

    // Rastgele bir şarkı seç
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selected = pool[randomIndex];
    const trackId = typeof selected === 'object' ? selected.id : selected;

    // Deezer'dan detay çek
    const deezerRes = await fetch(`https://api.deezer.com/track/${trackId}`);
    const track = await deezerRes.json();

    if (track.error) {
      return NextResponse.json({ error: 'Deezer şarkı bulunamadı' }, { status: 404 });
    }

    const durationMins = Math.floor(track.duration / 60);
    const durationSecs = track.duration % 60;
    const durationStr = `${durationMins}:${durationSecs.toString().padStart(2, '0')}`;
    const year = track.release_date ? track.release_date.split('-')[0] : 'Bilinmiyor';

    return NextResponse.json({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      preview: track.preview,
      cover: track.album.cover_xl,
      release_date: year,
      album: track.album.title,
      duration: durationStr
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server hatası' }, { status: 500 });
  }
}
