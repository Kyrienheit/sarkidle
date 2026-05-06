'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getCurrentGameId, getArchiveDays } from '../utils/time';
import { loadGameState, saveGameState } from '../utils/storage';

const TRY_LIMITS = [1, 3, 5, 10, 30, 30];
const TOTAL_DURATION = 30;

export default function Home() {
  const [activeModal, setActiveModal] = useState(null);
  const [showEndGameModal, setShowEndGameModal] = useState(false); // Sonuç ekranı görünürlüğü

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(1);
  const [gameState, setGameState] = useState(null);
  const [todaysSong, setTodaysSong] = useState(null);

  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'lost'

  const audioRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTry, setCurrentTry] = useState(0);

  const [guesses, setGuesses] = useState([
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
  ]);

  // GTA Hilesi: "yeniden" yazınca o günü sıfırlar
  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e) => {
      // Harfleri biriktir
      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 15) keyBuffer = keyBuffer.slice(-15);

      if (keyBuffer.includes('yeniden')) {
        const state = loadGameState();
        if (state && state.history) {
          delete state.history[currentGameId]; // Sadece o günkü veriyi sil
          saveGameState(state);
          window.location.reload(); // Sayfayı yenile ve tertemiz başla
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGameId]);

  useEffect(() => {
    // URL'de ?day=X varsa o günü oyna, yoksa bugünün IDsini al
    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day');

    let dayId = getCurrentGameId();
    if (dayParam && !isNaN(dayParam)) {
      dayId = parseInt(dayParam, 10);
    }

    setCurrentGameId(dayId);

    const state = loadGameState();
    setGameState(state);

    fetch(`/api/daily?day=${dayId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setTodaysSong(data);

          if (state && state.history && state.history[dayId]) {
            const historyData = state.history[dayId];
            setGameStatus(historyData.status);
            setShowEndGameModal(true); // Önceden oynadıysa direkt sonucu göster
            if (historyData.guesses) {
              setGuesses(historyData.guesses);
            }
            setCurrentTry(5);
          }
        }
      });
  }, []);

  useEffect(() => {
    if (query.length > 2 && !selectedTrack) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        fetch(`/api/search?q=${query}`)
          .then(res => res.json())
          .then(data => setResults(data.data || []))
          .catch(() => setResults([]));
      }, 250);
    } else {
      setResults([]);
    }
  }, [query, selectedTrack]);

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const limit = gameStatus === 'playing' ? TRY_LIMITS[currentTry] : TOTAL_DURATION;

    setProgress((current / TOTAL_DURATION) * 100);

    if (current >= limit) {
      audioRef.current.pause();
      setIsPlaying(false);
      audioRef.current.currentTime = 0;
      setTimeout(() => setProgress(0), 100);
    }
  };

  const saveResult = (status, finalGuesses) => {
    const newState = { ...gameState };

    newState.stats.played += 1;
    if (status === 'won') {
      newState.stats.wins += 1;
      newState.stats.currentStreak += 1;
      if (newState.stats.currentStreak > newState.stats.maxStreak) {
        newState.stats.maxStreak = newState.stats.currentStreak;
      }
    } else {
      newState.stats.currentStreak = 0;
    }

    newState.history[currentGameId] = {
      status: status,
      attempts: currentTry + 1,
      guesses: finalGuesses
    };

    setGameState(newState);
    saveGameState(newState);
    setGameStatus(status);
    setShowEndGameModal(true); // Oyun bittiğinde modalı aç
  };

  const handleSkip = () => {
    if (currentTry >= 6 || gameStatus !== 'playing') return;
    const newGuesses = [...guesses];
    newGuesses[currentTry] = { status: 'skip', text: 'ATLANDI' };
    setGuesses(newGuesses);

    if (currentTry === 5) {
      saveResult('lost', newGuesses);
    } else {
      setCurrentTry(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    if (currentTry >= 6 || gameStatus !== 'playing' || !query) return;

    // Şarkı ve sanatçı tamamen aynı mı?
    const isExactMatch = selectedTrack
      ? selectedTrack.id === todaysSong.id
      : query.toLowerCase() === `${todaysSong.artist} - ${todaysSong.title}`.toLowerCase();

    // Sadece sanatçı doğru mu?
    const guessedArtist = selectedTrack
      ? selectedTrack.artist
      : query.split('-')[0]?.trim();

    const isArtistMatch = guessedArtist && guessedArtist.toLowerCase() === todaysSong.artist.toLowerCase();

    const newGuesses = [...guesses];
    const guessText = selectedTrack ? `${selectedTrack.artist} - ${selectedTrack.title}` : query;

    if (isExactMatch) {
      newGuesses[currentTry] = { status: 'correct', text: `${todaysSong.artist} - ${todaysSong.title}` };
      setGuesses(newGuesses);
      saveResult('won', newGuesses);
    } else if (isArtistMatch) {
      newGuesses[currentTry] = { status: 'partial', text: guessText };
      setGuesses(newGuesses);

      if (currentTry === 5) {
        saveResult('lost', newGuesses);
      } else {
        setCurrentTry(prev => prev + 1);
      }
    } else {
      newGuesses[currentTry] = { status: 'wrong', text: guessText };
      setGuesses(newGuesses);

      if (currentTry === 5) {
        saveResult('lost', newGuesses);
      } else {
        setCurrentTry(prev => prev + 1);
      }
    }

    setQuery('');
    setSelectedTrack(null);
    setResults([]);
  };

  const renderModal = () => {
    if (!activeModal) return null;

    // Arşiv için hesaplamalar: O anki "GERÇEK" günün arşivini göstermeliyiz.
    const realDayId = getCurrentGameId();

    return (
      <div className="modal-overlay" onClick={() => setActiveModal(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setActiveModal(null)}>×</button>

          {activeModal === 'archive' && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Önceki Günler</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {getArchiveDays(realDayId).length === 0 && <p style={{ color: 'var(--text-secondary)' }}>İlk gün!!</p>}

                {/* Geçmiş günleri listele */}
                {getArchiveDays(realDayId).map(day => {
                  const dayData = gameState?.history?.[day];
                  const statusLabel = dayData ? (dayData.status === 'win' ? '✅ Bildin' : '❌ Bilemedin') : '▶️ Oyna';

                  return (
                    <div key={day} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--border-color)', borderRadius: '8px', alignItems: 'center' }}>
                      <span>Gün #{day}</span>
                      <button
                        className={dayData ? "secondary-btn" : "primary-btn-small"}
                        style={{ fontSize: '0.85rem', padding: '6px 12px', borderRadius: '4px' }}
                        onClick={() => {
                          window.location.href = `/?day=${day}`;
                        }}
                      >
                        {statusLabel}
                      </button>
                    </div>
                  )
                })}

                {/* Eğer eski bir gündeysek "Bugünü Oyna" butonu koy */}
                {currentGameId !== realDayId && (
                  <button
                    className="btn btn-submit"
                    style={{ marginTop: '10px', padding: '10px' }}
                    onClick={() => window.location.href = `/`}
                  >
                    GERİ DÖN: BUGÜNÜ OYNA
                  </button>
                )}
              </div>
            </div>
          )}

          {activeModal === 'stats' && (
            <div>
              <h2 style={{ marginBottom: '1rem', color: 'var(--gold-primary)' }}>İstatistikler</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Oynanan: {gameState?.stats?.played || 0}</p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Kazanma Oranı: %{gameState?.stats?.played ? Math.round((gameState?.stats?.wins / gameState?.stats?.played) * 100) : 0}</p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Seri: {gameState?.stats?.currentStreak || 0}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Maksimum Seri: {gameState?.stats?.maxStreak || 0}</p>
            </div>
          )}

          {activeModal === 'help' && (
            <div>
              <h2 style={{ marginBottom: '1rem', color: 'var(--gold-primary)' }}>Nasıl Oynanır?</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Günlük şarkıyı tahmin etmek için 6 hakkın var. Her yanlış tahminde veya atladığında şarkının süresi uzar ve sana yeni bir ipucu verilir.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 20, height: 20, background: 'var(--success-color)', borderRadius: 4 }}></div>
                  <span><strong>Yeşil:</strong> Şarkı ve sanatçı tamamen DOĞRU!</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 20, height: 20, background: '#f39c12', borderRadius: 4 }}></div>
                  <span><strong>Turuncu:</strong> Sanatçı DOĞRU, ancak şarkı yanlış.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid var(--wrong-color)', borderRadius: 4 }}></div>
                  <span><strong>Kırmızı:</strong> Sanatçı da şarkı da YANLIŞ.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEndGameModal = () => {
    if (!showEndGameModal) return null;
    const isWin = gameStatus === 'won';

    return (
      <div className="modal-overlay" style={{ zIndex: 50 }}>
        <div className="modal-content" style={{ textAlign: 'center' }}>
          {/* Çarpı butonu eklendi, artık kapatılabilir */}
          <button className="modal-close" onClick={() => setShowEndGameModal(false)}>×</button>

          <h2 style={{ color: isWin ? 'var(--success-color)' : 'var(--wrong-color)', marginBottom: '1.5rem' }}>
            {isWin ? 'Tebrikler!' : 'Maalesef Bilemedin'}
          </h2>

          <img
            src={todaysSong.cover}
            alt="cover"
            style={{ width: '200px', height: '200px', borderRadius: '12px', marginBottom: '1rem', objectFit: 'cover', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
          />
          <h3 style={{ fontSize: '1.4rem' }}>{todaysSong.title}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>{todaysSong.artist}</p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg-color)', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{isWin ? currentTry + 1 : 'X'}/6</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Deneme</p>
            </div>
          </div>

          <button className="btn btn-submit" style={{ width: '100%' }} onClick={() => {
            alert("daha eklemedim bu tuşu");
          }}>
            SONUCU PAYLAŞ
          </button>

          {/* Arşive yönlendiren yeni buton */}
          <button
            className="btn btn-skip"
            style={{ width: '100%', marginTop: '10px', fontSize: '0.9rem', padding: '10px' }}
            onClick={() => {
              setShowEndGameModal(false);
              setActiveModal('archive');
            }}
          >
            ESKİ GÜNLERİ OYNA
          </button>
        </div>
      </div>
    );
  };

  const getSegmentClass = (index) => {
    if (gameStatus !== 'playing') return 'progress-segment active';
    return index <= currentTry ? 'progress-segment active' : 'progress-segment';
  };

  if (!todaysSong) {
    return (
      <main className="game-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="lds-ripple"><div></div><div></div></div>
        <p style={{ marginTop: '20px', color: 'var(--gold-primary)', fontWeight: 'bold', letterSpacing: '1px' }}>Yükleniyor...</p>
      </main>
    );
  }

  const renderHints = () => {
    if (gameStatus !== 'playing') return null;

    const hints = [];
    if (currentTry >= 1) hints.push(`⏱️ Uzunluk: ${todaysSong.duration}`);
    if (currentTry >= 2) hints.push(`📅 Çıkış Yılı: ${todaysSong.release_date}`);
    if (currentTry >= 3) hints.push(`💽 Albüm: ${todaysSong.album}`);
    if (currentTry >= 4) hints.push(`🎤 Sanatçının İlk Harfi: ${todaysSong.artist.charAt(0)}`);
    if (currentTry >= 5) hints.push(`🎵 Sanatçı: ${todaysSong.artist}`);

    return (
      <div className="hints-container" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Arkaplan Ses Dalgaları (Waveform) Animasyonu */}
        <div className="waveform-container">
          {[...Array(25)].map((_, i) => {
            const duration = 0.3 + ((i * 7) % 5) * 0.1;
            const delay = ((i * 3) % 4) * 0.1;
            return (
              <div
                key={i}
                className={`waveform-bar ${isPlaying ? 'active' : ''}`}
                style={isPlaying ? { animationDuration: `${duration}s`, animationDelay: `${delay}s` } : {}}
              />
            );
          })}
        </div>

        {/* Eğer ipucu varsa yazıları göster (Z-Index ile önde tut) */}
        {hints.length > 0 && (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <strong style={{ color: 'var(--gold-primary)', display: 'block', marginBottom: '5px' }}>İpuçları:</strong>
            <div className="hints-list">
              {hints.map((h, i) => <div key={i} className="hint-item">{h}</div>)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="game-container">
      {renderModal()}
      {renderEndGameModal()}

      <audio
        ref={audioRef}
        src={todaysSong.preview}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
      />

      <header className="header">
        <div className="header-icons" onClick={() => setActiveModal('help')}>❓</div>
        <h1>ŞARKIDLE</h1>
        <div className="header-icons" style={{ display: 'flex', gap: '15px' }}>
          <span onClick={() => setActiveModal('stats')}>📊</span>
          <span onClick={() => setActiveModal('archive')}>🗂️</span>
        </div>
      </header>

      {/* İpuçları Paneli (Sabit ve Üstte) */}
      {gameStatus === 'playing' && renderHints()}

      <div className="guesses">
        {guesses.map((g, i) => (
          <div key={i} className={`guess-box ${g.status}`}>
            {g.text}
          </div>
        ))}
      </div>

      {/* Oyun bitince orijinal kontroller yerine Deezer Widget'ı koyuyoruz! */}
      {gameStatus === 'playing' ? (
        <div className="player-controls">
          <div className="progress-bar" style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              background: 'var(--gold-primary)', width: `${progress}%`, transition: 'width 0.1s linear', zIndex: 2
            }}></div>

            <div className={getSegmentClass(0)} style={{ width: '3.33%', zIndex: 1 }}></div>
            <div className={getSegmentClass(1)} style={{ width: '6.66%', zIndex: 1 }}></div>
            <div className={getSegmentClass(2)} style={{ width: '6.66%', zIndex: 1 }}></div>
            <div className={getSegmentClass(3)} style={{ width: '16.66%', zIndex: 1 }}></div>
            <div className={getSegmentClass(4)} style={{ width: '66.66%', borderRight: 'none', zIndex: 1 }}></div>
          </div>

          <div className="play-btn-wrapper">
            <button className="play-btn" onClick={handlePlay}>
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden' }}>
          <iframe
            title="deezer-widget"
            src={`https://widget.deezer.com/widget/dark/track/${todaysSong.id}`}
            width="100%"
            height="150"
            frameBorder="0"
            allowtransparency="true"
            allow="encrypted-media; clipboard-write">
          </iframe>
        </div>
      )}

      {gameStatus === 'playing' && (
        <>
          <div className="search-container">
            {results.length > 0 && (
              <div className="dropdown">
                {results.map(track => (
                  <div key={track.id} className="dropdown-item" onClick={() => {
                    setSelectedTrack(track);
                    setQuery(`${track.artist} - ${track.title}`);
                    setResults([]);
                  }}>
                    <img src={track.cover} alt="cover" />
                    <div className="dropdown-info">
                      <span className="dropdown-title">{track.title}</span>
                      <span className="dropdown-artist">{track.artist}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input
              type="text"
              className="search-input"
              placeholder="Bir şarkı veya sanatçı tahmin et..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedTrack(null);
              }}
            />
          </div>

          <div className="action-buttons">
            <button className="btn btn-skip" onClick={handleSkip}>ATLA</button>
            <button className="btn btn-submit" onClick={handleSubmit}>GÖNDER</button>
          </div>
        </>
      )}
    </main>
  );
}
