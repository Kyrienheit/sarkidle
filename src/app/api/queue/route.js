import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function GET() {
  try {
    const queue = await redis.get('queue') || [];
    return NextResponse.json(queue);
  } catch (error) {
    return NextResponse.json({ error: 'Queue okunamadı' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const track = await request.json(); 
    
    let queue = await redis.get('queue') || [];
    queue.push(track);
    
    await redis.set('queue', queue);

    return NextResponse.json({ success: true, queue });
  } catch (error) {
    return NextResponse.json({ error: 'Queue yazılamadı' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const index = parseInt(searchParams.get('index'), 10);
    
    let queue = await redis.get('queue') || [];
    if(index >= 0 && index < queue.length) {
       queue.splice(index, 1);
       await redis.set('queue', queue);
       return NextResponse.json({ success: true, queue });
    }
    return NextResponse.json({ error: 'Geçersiz indeks' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Hata' }, { status: 500 });
  }
}
