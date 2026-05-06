import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/data/queue.json');

export async function GET() {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const queue = JSON.parse(fileContents);
    return NextResponse.json(queue);
  } catch (error) {
    return NextResponse.json({ error: 'Queue okunamadı' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const track = await request.json(); 
    
    let queue = [];
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      queue = JSON.parse(fileContents);
    }

    queue.push(track);
    fs.writeFileSync(filePath, JSON.stringify(queue, null, 2));

    return NextResponse.json({ success: true, queue });
  } catch (error) {
    return NextResponse.json({ error: 'Queue yazılamadı' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const index = parseInt(searchParams.get('index'), 10);
    
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      let queue = JSON.parse(fileContents);
      if(index >= 0 && index < queue.length) {
         queue.splice(index, 1);
         fs.writeFileSync(filePath, JSON.stringify(queue, null, 2));
         return NextResponse.json({ success: true, queue });
      }
    }
    return NextResponse.json({ error: 'Geçersiz indeks' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Hata' }, { status: 500 });
  }
}
