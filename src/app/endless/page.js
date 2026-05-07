'use client';
import React, { useState, useEffect, useRef } from 'react';

const TRY_LIMITS = [1, 3, 5, 10, 30, 30];
const TOTAL_DURATION = 30;

export default function EndlessMode() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [loading, setLoading] = useState(true);

  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'lost', 'run_over'
  const [streak, setStreak] = useState(0);
  const [bestStreakEasy, setBestStreakEasy] = useState(0);
  const [bestStreakHard, setBestStreakHard] = useState(0);
  const [currentRunCount, setCurrentRunCount] = useState(1);

  // Difficulty & Category
  const [difficulty, setDifficulty] = useState('easy');
  const [category, setCategory] = useState('mixed');
  const [lives, setLives] = useState(3);

  const audioRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTry, setCurrentTry] = useState(0);
  const lastSongIdRef = useRef(null);
  const [playedIds, setPlayedIds] = useState([]); // Bu run'da oynanan şarkılar
  const [isFinished, setIsFinished] = useState(false); // Playlist bitti mi?

  const [guesses, setGuesses] = useState([
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
    { status: 'empty', text: '' },
  ]);

  // URL parametrelerini oku
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const diff = params.get('difficulty') || 'easy';
      const cat = params.get('category') || 'mixed';
      setDifficulty(diff);
      setCategory(cat);
      if (diff === 'hard') setLives(3);

      const saved = localStorage.getItem('sarkidle_endless_stats');
      if (saved) {
        try {
          const stats = JSON.parse(saved);
          setStreak(stats.currentStreak || 0);
          setBestStreakEasy(stats.bestStreakEasy || stats.bestStreak || 0);
          setBestStreakHard(stats.bestStreakHard || 0);
        } catch (e) { /* ignore */ }
      }
    }
  }, []);

  const saveEndlessStats = (newStreak, newBestEasy, newBestHard) => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sarkidle_endless_stats');
      let oldStats = {};
      try { oldStats = JSON.parse(saved) || {}; } catch (e) { }

      localStorage.setItem('sarkidle_endless_stats', JSON.stringify({
        ...oldStats,
        currentStreak: newStreak,
        bestStreakEasy: newBestEasy,
        bestStreakHard: newBestHard
      }));
    }
  };

  const fetchNewSong = async () => {
    if (gameStatus === 'run_over' || isFinished) {
      window.location.reload(); // Restart the run
      return;
    }

    setLoading(true);
    try {
      const exclude = playedIds.length > 0 ? `&excludeIds=${playedIds.join(',')}` : '';
      const res = await fetch(`/api/endless?category=${category}${exclude}`);
      const data = await res.json();

      if (data.finished) {
        setIsFinished(true);
        setGameStatus('finished');
        setLoading(false);
        return;
      }

      if (data.error) {
        alert(data.error);
        setLoading(false);
        return;
      }

      lastSongIdRef.current = data.id;
      setCurrentSong(data);
      setGameStatus('playing');
      setCurrentTry(0);
      setQuery('');
      setSelectedTrack(null);
      setResults([]);
      setIsPlaying(false);
      setProgress(0);
      setGuesses([
        { status: 'empty', text: '' },
        { status: 'empty', text: '' },
        { status: 'empty', text: '' },
        { status: 'empty', text: '' },
        { status: 'empty', text: '' },
        { status: 'empty', text: '' },
      ]);
    } catch (error) {
      console.error('Şarkı yüklenemedi:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNewSong();
  }, []);

  // Arama
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

  const finishGame = (status) => {
    let nextStatus = status;
    let newStreak = isWin ? streak + 1 : 0;
    if (status === 'lost') newStreak = 0;

    let newBestEasy = bestStreakEasy;
    let newBestHard = bestStreakHard;

    if (status === 'won') {
      if (difficulty === 'easy' && newStreak > bestStreakEasy) newBestEasy = newStreak;
      if (difficulty === 'hard' && newStreak > bestStreakHard) newBestHard = newStreak;
    }

    if (status === 'lost' && difficulty === 'hard') {
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        nextStatus = 'run_over';
      }
    }

    setGameStatus(nextStatus);
    setStreak(newStreak);
    setBestStreakEasy(newBestEasy);
    setBestStreakHard(newBestHard);

    // Kalıcı istatistikleri de arka planda güncelle (ana sayfada göstermek için)
    const saved = localStorage.getItem('sarkidle_endless_stats');
    let stats = {};
    try { stats = JSON.parse(saved) || {}; } catch (e) { }

    localStorage.setItem('sarkidle_endless_stats', JSON.stringify({
      ...stats,
      currentStreak: newStreak,
      bestStreakEasy: newBestEasy,
      bestStreakHard: newBestHard,
      totalPlayed: (stats.totalPlayed || 0) + 1,
      totalWins: (stats.totalWins || 0) + (status === 'won' ? 1 : 0)
    }));

    // Oynananlara ekle (bildiği şarkı bir daha gelmesin)
    if (currentSong) {
      setPlayedIds(prev => [...prev, String(currentSong.id)]);
    }
  };

  const handleSkip = () => {
    if (currentTry >= 6 || gameStatus !== 'playing') return;
    const newGuesses = [...guesses];
    newGuesses[currentTry] = { status: 'skip', text: 'ATLANDI' };
    setGuesses(newGuesses);

    if (currentTry === 5) {
      finishGame('lost');
    } else {
      setCurrentTry(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    if (currentTry >= 6 || gameStatus !== 'playing' || !query) return;

    const isExactMatch = selectedTrack
      ? selectedTrack.id === currentSong.id
      : query.toLowerCase() === `${currentSong.artist} - ${currentSong.title}`.toLowerCase();

    const guessedArtist = selectedTrack
      ? selectedTrack.artist
      : query.split('-')[0]?.trim();

    const isArtistMatch = guessedArtist && guessedArtist.toLowerCase() === currentSong.artist.toLowerCase();

    const newGuesses = [...guesses];
    const guessText = selectedTrack ? `${selectedTrack.artist} - ${selectedTrack.title}` : query;

    if (isExactMatch) {
      newGuesses[currentTry] = { status: 'correct', text: `${currentSong.artist} - ${currentSong.title}` };
      setGuesses(newGuesses);
      finishGame('won');
    } else if (isArtistMatch) {
      newGuesses[currentTry] = { status: 'partial', text: guessText };
      setGuesses(newGuesses);
      if (currentTry === 5) finishGame('lost');
      else setCurrentTry(prev => prev + 1);
    } else {
      newGuesses[currentTry] = { status: 'wrong', text: guessText };
      setGuesses(newGuesses);
      if (currentTry === 5) finishGame('lost');
      else setCurrentTry(prev => prev + 1);
    }

    setQuery('');
    setSelectedTrack(null);
    setResults([]);
  };

  const getSegmentClass = (index) => {
    if (gameStatus !== 'playing') return 'progress-segment active';
    return index <= currentTry ? 'progress-segment active' : 'progress-segment';
  };

  const renderHints = () => {
    if (difficulty !== 'easy' || gameStatus !== 'playing' || !currentSong) return null;

    const hints = [];
    if (currentTry >= 1) hints.push(`⏱️ Uzunluk: ${currentSong.duration}`);
    if (currentTry >= 2) hints.push(`📅 Çıkış Yılı: ${currentSong.release_date}`);
    if (currentTry >= 3) hints.push(`💽 Albüm: ${currentSong.album}`);
    if (currentTry >= 4) hints.push(`🎤 İlk Harf: ${currentSong.artist.charAt(0)}`);
    if (currentTry >= 5) hints.push(`🎵 Sanatçı: ${currentSong.artist}`);

    return (
      <div className="hints-container" style={{ position: 'relative', overflow: 'hidden', marginBottom: '15px' }}>
        <div className="waveform-container">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className={`waveform-bar ${isPlaying ? 'active' : ''}`}
              style={{
                height: isPlaying ? `${20 + Math.random() * 60}%` : '15%',
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
        <div className="hints-list" style={{ position: 'relative', zIndex: 2 }}>
          {hints.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>İpuçları için tahmin yap veya atla...</p>
          ) : (
            hints.map((hint, i) => <div key={i} className="hint-item">{hint}</div>)
          )}
        </div>
      </div>
    );
  };

  const isWin = gameStatus === 'won';

  if (loading || !currentSong) {
    return (
      <main className="game-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="lds-ripple"><div></div><div></div></div>
        <p style={{ marginTop: '20px', color: 'var(--gold-primary)', fontWeight: 'bold', letterSpacing: '1px' }}>Şarkı Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="game-container">
      <audio
        ref={audioRef}
        src={currentSong.preview}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
      />

      <header className="header" style={{ marginBottom: '15px' }}>
        <div className="header-icons" onClick={() => window.location.href = '/'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block' }}>OYNANAN</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>#{currentRunCount}</span>
          </div>

          <div style={{ width: '1px', height: '25px', background: 'var(--border-color)' }}></div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block' }}>SERİ</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold-primary)' }}>{streak}</span>
          </div>

          <div style={{ width: '1px', height: '25px', background: 'var(--border-color)' }}></div>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', fontWeight: 600 }}>EN İYİ SERİ</span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>KOLAY: <span style={{ color: 'var(--gold-primary)' }}>{bestStreakEasy}</span></span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>ZOR: <span style={{ color: 'var(--wrong-color)' }}>{bestStreakHard}</span></span>
            </div>
          </div>
        </div>

        <div className="header-icons" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          {difficulty === 'hard' && (
            <div className="endless-lives">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={`heart ${i >= lives ? 'empty' : ''}`} style={{ fontSize: '1rem' }}>❤️</span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* İpuçları */}
      {renderHints()}

      {/* Tahminler */}
      <div className="guesses">
        {guesses.map((g, i) => (
          <div key={i} className={`guess-box ${g.status}`}>
            {g.text}
          </div>
        ))}
      </div>

      {/* Oyun alanı: devam ediyorsa player, bittiyse sonuç */}
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
      ) : gameStatus === 'finished' ? (
        <div className="run-over-screen">
          <div className="run-over-title" style={{ color: 'var(--gold-primary)' }}>OYUN BİTTİ!</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '25px' }}>
            Helal..<br />
            (Liste çok da sonsuz değilmiş. Ha ama sonsuz yapma amacın varsa buradan önerini ekleyebilirsin.)
          </p>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🏆</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn btn-submit" onClick={() => window.location.href = '/oner'} style={{ padding: '15px', background: 'var(--gold-primary)', color: 'black' }}>
              ŞARKI ÖNER ✍️
            </button>
            <button className="btn btn-submit" onClick={() => window.location.href = '/'} style={{ padding: '15px', background: 'transparent', border: '1px solid var(--border-color)' }}>
              ANA MENÜYE DÖN
            </button>
          </div>
        </div>
      ) : gameStatus === 'run_over' ? (
        <div className="run-over-screen">
          <div className="run-over-title">RUN BİTTİ</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '25px' }}>
            3 canın tükendi. Toplam {totalWins} şarkı bildin!
          </p>
          <div className="endless-result-header" style={{ justifyContent: 'center', marginBottom: '20px' }}>
            <div className="endless-result-info" style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1rem' }}>Son Şarkı: {currentSong.title}</h3>
              <p style={{ fontSize: '0.8rem' }}>{currentSong.artist}</p>
            </div>
          </div>
          <button className="btn btn-submit" onClick={() => window.location.reload()} style={{ padding: '15px' }}>
            YENİDEN BAŞLA
          </button>
        </div>
      ) : (
        /* Oyun bitti — sonuç ve Deezer widget */
        <div className="endless-result">
          <div className="endless-result-header">
            <img
              src={currentSong.cover}
              alt="cover"
              className="endless-result-cover"
            />
            <div className="endless-result-info">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{currentSong.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{currentSong.artist}</p>
              <p style={{
                color: isWin ? 'var(--success-color)' : 'var(--wrong-color)',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                marginTop: '6px'
              }}>
                {isWin ? `✅ ${currentTry + 1}/6 denemede bildin!` : '❌ Bilemedin'}
              </p>
            </div>
          </div>

          <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
            <iframe
              title="deezer-widget"
              src={`https://widget.deezer.com/widget/dark/track/${currentSong.id}`}
              width="100%"
              height="100"
              frameBorder="0"
              allowtransparency="true"
              allow="encrypted-media; clipboard-write">
            </iframe>
          </div>

          <button className="btn btn-submit endless-next-btn" onClick={fetchNewSong}>
            SONRAKİ ŞARKI ▶
          </button>
        </div>
      )}

      {/* Arama ve butonlar (oynarken) */}
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
              placeholder="Şarkı gir..."
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
