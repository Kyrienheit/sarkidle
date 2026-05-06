'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function AdminPanel() {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  
  const [queue, setQueue] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (auth) {
      fetch('/api/queue')
        .then(res => res.json())
        .then(data => setQueue(data))
        .catch(err => console.error(err));
    }
  }, [auth]);

  useEffect(() => {
    if (query.length > 2) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        fetch(`/api/search?q=${query}`)
          .then(res => res.json())
          .then(data => setResults(data.data || []))
          .catch(() => setResults([]));
      }, 300);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleLogin = () => {
    if (password === '3481') setAuth(true); // Gizli şifre: 3481
    else alert('Yanlış şifre!');
  };

  const addToQueue = async (track) => {
    // Listeye eklenecek nesneyi oluştur
    const newTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist?.name || track.artist || 'Bilinmeyen Sanatçı',
      cover: track.album?.cover_small || track.cover || 'https://via.placeholder.com/40'
    };

    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrack)
    });
    
    if (res.ok) {
      const data = await res.json();
      setQueue(data.queue);
      setQuery('');
      setResults([]);
    }
  };

  const removeFromQueue = async (index) => {
    if(!confirm('Bu şarkıyı sıradan silmek istediğine emin misin?')) return;
    
    const res = await fetch(`/api/queue?index=${index}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setQueue(data.queue);
    }
  };

  if (!auth) {
    return (
      <div className="game-container" style={{justifyContent: 'center'}}>
        <h1 style={{textAlign: 'center', marginBottom: '20px', color: 'var(--gold-primary)'}}>Gizli Admin Girişi</h1>
        <input 
          type="password" 
          className="search-input" 
          placeholder="Şifre" 
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        <button className="btn btn-submit" style={{marginTop: '10px'}} onClick={handleLogin}>GİRİŞ YAP</button>
      </div>
    );
  }

  return (
    <div className="game-container" style={{maxWidth: '600px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
         <h1 style={{color: 'var(--gold-primary)'}}>Admin Paneli</h1>
         <button className="btn btn-skip" style={{width: 'auto', padding: '10px'}} onClick={() => window.location.href = '/'}>Oyuna Dön</button>
      </div>
      
      <p style={{color: 'var(--text-secondary)', marginBottom: '15px'}}>Sıradaki Günlerin Şarkılarını Belirle. Arama yapıp listeden ekle.</p>

      {/* Şarkı Arama */}
      <div className="search-container" style={{zIndex: 100, marginBottom: '20px'}}>
        <input 
          type="text" 
          className="search-input" 
          placeholder="Deezer'da şarkı ara ve sıraya ekle..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div className="dropdown" style={{position: 'absolute', top: '100%', bottom: 'auto', borderRadius: '0 0 8px 8px'}}>
            {results.map(track => (
              <div key={track.id} className="dropdown-item" style={{justifyContent: 'space-between'}}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <img src={track.album?.cover_small || track.cover || 'https://via.placeholder.com/40'} alt="cover" style={{width: 40, height: 40, marginRight: 10, borderRadius: 4}} />
                  <div className="dropdown-info">
                    <span className="dropdown-title">{track.title}</span>
                    <span className="dropdown-artist">{track.artist?.name || 'Bilinmeyen Sanatçı'}</span>
                  </div>
                </div>
                <button 
                  className="btn btn-submit" 
                  style={{padding: '5px 10px', fontSize: '0.8rem', width: 'auto'}}
                  onClick={() => addToQueue(track)}
                >
                  EKLE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 style={{marginTop: '10px', marginBottom: '10px', fontSize: '1.2rem', color: 'white'}}>Gelecek Şarkılar Sırası (Queue)</h2>
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flexGrow: 1, paddingBottom: '20px'}}>
        {queue.length === 0 && <p style={{color: 'var(--text-secondary)'}}>Sıra boş. Yukarıdan arama yaparak şarkı ekle.</p>}
        {queue.map((item, index) => {
          // Eski sadece ID olan array öğeleri için geriye dönük destek
          const isLegacy = typeof item !== 'object';
          const title = isLegacy ? `Bilinmeyen Şarkı (Eski ID: ${item})` : item.title;
          const artist = isLegacy ? 'APIden otomatik çekilecek' : item.artist;
          const cover = isLegacy ? null : item.cover;

          return (
            <div key={index} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--input-bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <span style={{color: 'var(--gold-primary)', fontWeight: 'bold', marginRight: '15px'}}>Gün #{index + 1}</span>
                {cover && <img src={cover} alt="cover" style={{width: 40, height: 40, borderRadius: '4px', marginRight: '10px'}} />}
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  <span style={{fontWeight: 'bold', fontSize: '0.9rem'}}>{title}</span>
                  <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{artist}</span>
                </div>
              </div>
              <button 
                className="btn btn-skip" 
                style={{padding: '5px 10px', width: 'auto', borderColor: 'var(--wrong-color)', color: 'var(--wrong-color)'}}
                onClick={() => removeFromQueue(index)}
              >
                SİL
              </button>
            </div>
          )
        })}
      </div>
    </div>
  );
}
