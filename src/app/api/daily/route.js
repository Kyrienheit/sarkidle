import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const day = parseInt(searchParams.get('day') || '1', 10);

  try {
    const filePath = path.join(process.cwd(), 'src/data/queue.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const queue = JSON.parse(fileContents);

    const queueItem = queue[day - 1]; 
    const trackId = typeof queueItem === 'object' ? queueItem.id : queueItem;
    
    if (!trackId) {
      return NextResponse.json({ error: 'Bu gün için şarkı bulunamadı.' }, { status: 404 });
    }

    const deezerRes = await fetch(`https://api.deezer.com/track/${trackId}`);
    const track = await deezerRes.json();

    // Süreyi dakika:saniye formatına çevir
    const durationMins = Math.floor(track.duration / 60);
    const durationSecs = track.duration % 60;
    const durationStr = `${durationMins}:${durationSecs.toString().padStart(2, '0')}`;

    // Yılı al
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
