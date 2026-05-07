import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SUGGESTIONS_KEY = 'sarkidle_suggestions';

// Önerileri getir
export async function GET() {
  try {
    const suggestions = await redis.get(SUGGESTIONS_KEY) || [];
    // Upvote sayısına göre sırala
    suggestions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json({ error: 'Öneriler yüklenemedi' }, { status: 500 });
  }
}

// Yeni öneri ekle
export async function POST(request) {
  try {
    const { track } = await request.json();
    
    // 1. Mevcut playlistlerde var mı kontrol et
    const categories = ['mixed', 'pop', 'rock'];
    for (const cat of categories) {
      const playlist = await redis.get(`endless_playlist_${cat}`) || [];
      if (playlist.some(item => String(item.id) === String(track.id))) {
        return NextResponse.json({ 
          error: `Bu şarkı zaten ${cat.toUpperCase()} playlistinde bulunuyor!`, 
          exists: true 
        }, { status: 409 });
      }
    }

    // 2. Mevcut önerilerde var mı kontrol et
    let suggestions = await redis.get(SUGGESTIONS_KEY) || [];
    if (suggestions.some(item => String(item.id) === String(track.id))) {
      return NextResponse.json({ 
        error: 'Bu şarkı zaten öneriler listesinde!', 
        exists: true 
      }, { status: 409 });
    }

    // 3. Ekle
    const newSuggestion = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover,
      upvotes: 1, // Öneren kişi otomatik bir oy vermiş sayılır
      createdAt: new Date().toISOString()
    };

    suggestions.push(newSuggestion);
    await redis.set(SUGGESTIONS_KEY, suggestions);

    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    return NextResponse.json({ error: 'Öneri eklenemedi' }, { status: 500 });
  }
}

// Oy ver (Upvote)
export async function PATCH(request) {
  try {
    const { id } = await request.json();
    let suggestions = await redis.get(SUGGESTIONS_KEY) || [];

    const index = suggestions.findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
      suggestions[index].upvotes = (suggestions[index].upvotes || 0) + 1;
      await redis.set(SUGGESTIONS_KEY, suggestions);
      return NextResponse.json({ success: true, upvotes: suggestions[index].upvotes });
    }

    return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Oylama başarısız' }, { status: 500 });
  }
}
