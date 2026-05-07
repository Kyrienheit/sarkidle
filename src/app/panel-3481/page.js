'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function AdminPanel() {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'endless'
  
  // --- Queue State ---
  const [queue, setQueue] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const typingTimeoutRef = useRef(null);

  // --- Endless State ---
  const [endlessCategory, setEndlessCategory] = useState('mixed');
  const [endlessPlaylist, setEndlessPlaylist] = useState([]);
  const [endlessQuery, setEndlessQuery] = useState('');
  const [endlessResults, setEndlessResults] = useState([]);
  const [endlessFilter, setEndlessFilter] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', msg: '' }
  const [isImporting, setIsImporting] = useState(false);
  const endlessTypingRef = useRef(null);

  useEffect(() => {
    if (auth) {
      fetch('/api/queue')
        .then(res => res.json())
        .then(data => setQueue(data))
        .catch(err => console.error(err));
    }
  }, [auth]);

  useEffect(() => {
    if (auth) {
      fetch(`/api/endless/playlist?category=${endlessCategory}`)
        .then(res => res.json())
        .then(data => setEndlessPlaylist(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    }
  }, [auth, endlessCategory]);

  // Queue arama
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

  // Endless arama
  useEffect(() => {
    if (endlessQuery.length > 2) {
      if (endlessTypingRef.current) clearTimeout(endlessTypingRef.current);
      endlessTypingRef.current = setTimeout(() => {
        fetch(`/api/search?q=${endlessQuery}`)
          .then(res => res.json())
          .then(data => setEndlessResults(data.data || []))
          .catch(() => setEndlessResults([]));
      }, 300);
    } else {
      setEndlessResults([]);
    }
  }, [endlessQuery]);

  const handleLogin = () => {
    if (password === '3481') setAuth(true); // Gizli şifre: 3481
    else alert('Yanlış şifre!');
  };

  // --- Queue Functions ---
  const addToQueue = async (track) => {
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

  // --- Endless Functions ---
  const addToEndless = async (track) => {
    const newTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist?.name || track.artist || 'Bilinmeyen Sanatçı',
      cover: track.album?.cover_small || track.cover || 'https://via.placeholder.com/40'
    };

    const res = await fetch('/api/endless/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: newTrack, category: endlessCategory })
    });

    const data = await res.json();

    if (res.status === 409) {
      setImportStatus({ type: 'warning', msg: `⚠️ "${newTrack.title}" zaten listede!` });
      setTimeout(() => setImportStatus(null), 3000);
      return;
    }

    if (res.ok) {
      setEndlessPlaylist(data.playlist);
      setEndlessQuery('');
      setEndlessResults([]);
      setImportStatus({ type: 'success', msg: `✅ "${newTrack.title}" eklendi!` });
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const removeFromEndless = async (id) => {
    if(!confirm('Bu şarkıyı endless listesinden silmek istediğine emin misin?')) return;

    const res = await fetch(`/api/endless/playlist?id=${id}&category=${endlessCategory}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setEndlessPlaylist(data.playlist);
    } else {
      const errorData = await res.json();
      alert(`Silme başarısız: ${errorData.error || 'Bilinmeyen hata'}`);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    setImportStatus(null);

    try {
      const res = await fetch('/api/endless/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl: importUrl.trim(), category: endlessCategory })
      });

      const data = await res.json();

      if (res.ok) {
        setEndlessPlaylist(data.playlist);
        setImportUrl('');
        setImportStatus({
          type: 'success',
          msg: `✅ ${data.added} şarkı eklendi, ${data.skipped} duplikat atlandı. Toplam: ${data.total}`
        });
      } else {
        setImportStatus({ type: 'error', msg: `❌ ${data.error}` });
      }
    } catch (error) {
      setImportStatus({ type: 'error', msg: '❌ Import sırasında bir hata oluştu.' });
    }
    setIsImporting(false);
  };

  // Filtrelenmiş endless playlist
  const filteredEndless = endlessFilter
    ? endlessPlaylist.filter(item =>
        (item.title?.toLowerCase().includes(endlessFilter.toLowerCase())) ||
        (item.artist?.toLowerCase().includes(endlessFilter.toLowerCase()))
      )
    : endlessPlaylist;

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

      {/* Tab Butonları */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          📋 Günlük Queue
        </button>
        <button
          className={`admin-tab ${activeTab === 'endless' ? 'active' : ''}`}
          onClick={() => setActiveTab('endless')}
        >
          ♾️ Endless Playlist
        </button>
      </div>

      {/* ========== QUEUE TAB ========== */}
      {activeTab === 'queue' && (
        <div>
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
      )}

      {/* ========== ENDLESS TAB ========== */}
      {activeTab === 'endless' && (
        <div>
          {/* Kategori Seçici */}
          <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
            {['mixed', 'pop', 'rock'].map(cat => (
              <button
                key={cat}
                className={`admin-tab ${endlessCategory === cat ? 'active' : ''}`}
                style={{flex: 1, fontSize: '0.8rem', padding: '8px'}}
                onClick={() => setEndlessCategory(cat)}
              >
                {cat === 'mixed' ? '🎵 Karışık' : cat === 'pop' ? '🎤 Pop' : '🎸 Rock'}
              </button>
            ))}
          </div>

          {/* Import Bölümü */}
          <div className="endless-import-section">
            <h3 style={{color: 'var(--gold-primary)', marginBottom: '10px', fontSize: '1rem'}}>📥 Deezer Playlist İmport</h3>
            <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '10px'}}>
              Deezer playlist linkini yapıştır, tüm şarkılar otomatik eklensin. Duplikatlar atlanır.
            </p>
            <div style={{display: 'flex', gap: '10px'}}>
              <input
                type="text"
                className="search-input"
                placeholder="https://www.deezer.com/playlist/..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                style={{flex: 1}}
              />
              <button
                className="btn btn-submit"
                style={{width: 'auto', padding: '10px 20px', opacity: isImporting ? 0.5 : 1}}
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? '⏳' : 'İMPORT'}
              </button>
            </div>
          </div>

          {/* Status mesajı */}
          {importStatus && (
            <div className={`endless-status endless-status-${importStatus.type}`}>
              {importStatus.msg}
            </div>
          )}

          {/* Manuel Ekleme */}
          <div style={{marginTop: '15px'}}>
            <h3 style={{color: 'var(--gold-primary)', marginBottom: '10px', fontSize: '1rem'}}>🔍 Tek Tek Şarkı Ekle</h3>
            <div className="search-container" style={{zIndex: 100, marginBottom: '15px'}}>
              <input
                type="text"
                className="search-input"
                placeholder="Deezer'da şarkı ara ve endless'a ekle..."
                value={endlessQuery}
                onChange={(e) => setEndlessQuery(e.target.value)}
              />
              {endlessResults.length > 0 && (
                <div className="dropdown" style={{position: 'absolute', top: '100%', bottom: 'auto', borderRadius: '0 0 8px 8px'}}>
                  {endlessResults.map(track => (
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
                        onClick={() => addToEndless(track)}
                      >
                        EKLE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Playlist Listesi */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', marginBottom: '10px'}}>
            <h2 style={{fontSize: '1.1rem', color: 'white'}}>
              Endless Playlist ({endlessPlaylist.length} şarkı)
            </h2>
          </div>

          {/* Filtreleme */}
          {endlessPlaylist.length > 5 && (
            <input
              type="text"
              className="search-input"
              placeholder="🔎 Listeyi filtrele (şarkı veya sanatçı)..."
              value={endlessFilter}
              onChange={(e) => setEndlessFilter(e.target.value)}
              style={{marginBottom: '15px', padding: '10px 15px', fontSize: '0.9rem'}}
            />
          )}

          <div style={{display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingBottom: '20px', maxHeight: '400px'}}>
            {filteredEndless.length === 0 && (
              <p style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '20px'}}>
                {endlessFilter ? 'Filtreleye uygun şarkı bulunamadı.' : 'Liste boş. Yukarıdan şarkı ekle veya playlist import et.'}
              </p>
            )}
            {filteredEndless.map((item, displayIndex) => {
              // Gerçek index'i bul (filtre varsa mapping gerekli)
              const realIndex = endlessFilter
                ? endlessPlaylist.findIndex(p => p.id === item.id)
                : displayIndex;

              return (
                <div key={item.id || displayIndex} className="endless-playlist-item">
                  <div style={{display: 'flex', alignItems: 'center', flex: 1, minWidth: 0}}>
                    <span className="endless-playlist-num">{realIndex + 1}</span>
                    {item.cover && <img src={item.cover} alt="cover" className="endless-playlist-cover" />}
                    <div style={{display: 'flex', flexDirection: 'column', minWidth: 0}}>
                      <span className="endless-playlist-title">{item.title}</span>
                      <span className="endless-playlist-artist">{item.artist}</span>
                    </div>
                  </div>
                  <button
                    className="endless-delete-btn"
                    onClick={() => removeFromEndless(item.id)}
                    title="Sil"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
