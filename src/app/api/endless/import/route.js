import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Deezer playlist URL'sinden şarkıları import et
export async function POST(request) {
  try {
    const { playlistUrl, category = 'mixed' } = await request.json();
    const redisKey = `endless_playlist_${category}`;

    // Deezer playlist ID'sini URL'den çıkar
    // Desteklenen formatlar: 
    //   https://www.deezer.com/playlist/123456
    //   https://www.deezer.com/tr/playlist/123456
    //   123456 (direkt ID)
    let playlistId = playlistUrl;
    const urlMatch = playlistUrl.match(/playlist\/(\d+)/);
    if (urlMatch) {
      playlistId = urlMatch[1];
    } else if (!/^\d+$/.test(playlistUrl)) {
      return NextResponse.json({ error: 'Geçersiz playlist URL veya ID' }, { status: 400 });
    }

    // Deezer API'den playlist şarkılarını çek (limit: 500)
    const deezerRes = await fetch(`https://api.deezer.com/playlist/${playlistId}/tracks?limit=500`);
    const deezerData = await deezerRes.json();

    if (deezerData.error) {
      return NextResponse.json({ error: 'Deezer playlist bulunamadı. URL\'yi kontrol et.' }, { status: 404 });
    }

    const incomingTracks = (deezerData.data || []).map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist?.name || 'Bilinmeyen',
      cover: track.album?.cover_small || ''
    }));

    // Mevcut playlist'i oku
    let playlist = await redis.get(redisKey) || [];
    const existingIds = new Set(playlist.map(item => String(item.id)));

    // Sadece yeni şarkıları ekle (duplikat atla)
    let addedCount = 0;
    let skippedCount = 0;

    for (const track of incomingTracks) {
      if (existingIds.has(String(track.id))) {
        skippedCount++;
      } else {
        playlist.push(track);
        existingIds.add(String(track.id));
        addedCount++;
      }
    }

    await redis.set(redisKey, playlist);

    return NextResponse.json({
      success: true,
      added: addedCount,
      skipped: skippedCount,
      total: playlist.length,
      playlist
    });
  } catch (error) {
    console.error('Import hatası:', error);
    return NextResponse.json({ error: 'Import sırasında hata oluştu' }, { status: 500 });
  }
}
