'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function OnerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Deezer Arama
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

  const addSuggestion = async (track) => {
    setErrorMsg('');
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track })
      });
      const data = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
        // 3 saniye sonra hatayı temizle
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }

      setQuery('');
      setResults([]);
      fetchSuggestions();
    } catch (e) {
      setErrorMsg('Bir hata oluştu.');
    }
  };

  const handleUpvote = async (id) => {
    try {
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchSuggestions();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <main className="game-container" style={{ padding: '20px' }}>
      <header className="header">
        <div className="header-icons" onClick={() => window.location.href = '/'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <h1>ŞARKI ÖNER</h1>
        <div className="header-icons"></div>
      </header>

      <div style={{ marginTop: '20px', marginBottom: '30px' }}>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '15px' }}>
          Sonsuz modda duymak istediğin şarkıları buraya ekle!
        </p>

        {/* Hata Mesajı */}
        {errorMsg && (
          <div className="endless-status endless-status-error" style={{ marginBottom: '15px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        {/* Arama Kutusu */}
        <div className="search-container" style={{ position: 'relative' }}>
          {results.length > 0 && (
            <div className="dropdown" style={{ bottom: 'auto', top: '100%' }}>
              {results.map(track => (
                <div key={track.id} className="dropdown-item" onClick={() => addSuggestion({
                  id: track.id,
                  title: track.title,
                  artist: track.artist,
                  cover: track.cover
                })}>
                  <img src={track.cover} alt="cover" />
                  <div className="dropdown-info">
                    <span className="dropdown-title">{track.title}</span>
                    <span className="dropdown-artist">{track.artist}</span>
                  </div>
                  <span style={{ color: 'var(--gold-primary)', fontSize: '0.8rem', fontWeight: 800 }}>EKLE +</span>
                </div>
              ))}
            </div>
          )}
          <input
            type="text"
            className="search-input"
            placeholder="Şarkı veya sanatçı arat..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Öneriler Listesi */}
      <div className="suggestions-list">
        <h2 style={{ fontSize: '1.1rem', color: 'var(--gold-primary)', marginBottom: '15px' }}>Top Öneriler 🔥</h2>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
        ) : suggestions.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Henüz öneri yok. İlkini sen yap!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {suggestions.map((item, idx) => (
              <div key={item.id} className="endless-playlist-item" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span style={{ marginRight: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '20px' }}>{idx + 1}</span>
                  <img src={item.cover} alt="cover" style={{ width: '32px', height: '32px', borderRadius: '4px', marginRight: '10px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.artist}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, color: 'var(--gold-primary)', fontSize: '0.9rem' }}>{item.upvotes || 0}</span>
                  <button 
                    className="endless-delete-btn" 
                    style={{ borderColor: 'var(--gold-primary)', color: 'var(--gold-primary)' }}
                    onClick={() => handleUpvote(item.id)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .suggestions-list {
          flex: 1;
          overflow-y: auto;
          margin-top: 10px;
        }
      `}</style>
    </main>
  );
}
