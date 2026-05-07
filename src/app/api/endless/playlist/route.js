import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Tüm endless playlist'i getir
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'mixed';
    const redisKey = `endless_playlist_${category}`;
    const playlist = await redis.get(redisKey) || [];
    return NextResponse.json(playlist);
  } catch (error) {
    return NextResponse.json({ error: 'Playlist okunamadı' }, { status: 500 });
  }
}

// Tek şarkı ekle (duplikat kontrolü ile)
export async function POST(request) {
  try {
    const { track, category = 'mixed' } = await request.json();
    const redisKey = `endless_playlist_${category}`;
    let playlist = await redis.get(redisKey) || [];

    // Duplikat kontrolü
    const isDuplicate = playlist.some(item => String(item.id) === String(track.id));
    if (isDuplicate) {
      return NextResponse.json({ error: 'Bu şarkı zaten listede!', duplicate: true }, { status: 409 });
    }

    playlist.push({
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover
    });

    await redis.set(redisKey, playlist);
    return NextResponse.json({ success: true, playlist });
  } catch (error) {
    return NextResponse.json({ error: 'Şarkı eklenemedi' }, { status: 500 });
  }
}

// Şarkı sil (index ile)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const index = parseInt(searchParams.get('index'), 10);
    const category = searchParams.get('category') || 'mixed';
    const redisKey = `endless_playlist_${category}`;

    let playlist = await redis.get(redisKey) || [];

    if (index >= 0 && index < playlist.length) {
      playlist.splice(index, 1);
      await redis.set(redisKey, playlist);
      return NextResponse.json({ success: true, playlist });
    }

    return NextResponse.json({ error: 'Geçersiz indeks' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Silme hatası' }, { status: 500 });
  }
}
