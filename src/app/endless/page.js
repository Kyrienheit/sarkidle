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
  const [bestStreak, setBestStreak] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [totalWins, setTotalWins] = useState(0);

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
          setBestStreak(stats.bestStreak || 0);
          setTotalPlayed(stats.totalPlayed || 0);
          setTotalWins(stats.totalWins || 0);
        } catch (e) { /* ignore */ }
      }
    }
  }, []);

  const saveEndlessStats = (newStreak, newBest, newPlayed, newWins) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sarkidle_endless_stats', JSON.stringify({
        currentStreak: newStreak,
        bestStreak: newBest,
        totalPlayed: newPlayed,
        totalWins: newWins
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
    const newPlayed = totalPlayed + 1;
    let newStreak = streak;
    let newWins = totalWins;
    let newBest = bestStreak;
    let nextStatus = status;

    if (status === 'won') {
      newStreak = streak + 1;
      newWins = totalWins + 1;
      if (newStreak > bestStreak) newBest = newStreak;
    } else {
      newStreak = 0;
      if (difficulty === 'hard') {
        const nextLives = lives - 1;
        setLives(nextLives);
        if (nextLives <= 0) {
          nextStatus = 'run_over';
        }
      }
    }

    setGameStatus(nextStatus);
    setStreak(newStreak);
    setBestStreak(newBest);
    setTotalPlayed(newPlayed);
    setTotalWins(newWins);
    saveEndlessStats(newStreak, newBest, newPlayed, newWins);

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
    if (gameStatus !== 'playing' || !currentSong) return null;

    const hints = [];
    if (currentTry >= 1) hints.push(`⏱️ Uzunluk: ${currentSong.duration}`);
    if (currentTry >= 2) hints.push(`📅 Çıkış Yılı: ${currentSong.release_date}`);
    if (currentTry >= 3) hints.push(`💽 Albüm: ${currentSong.album}`);
    if (currentTry >= 4) hints.push(`🎤 Sanatçının İlk Harfi: ${currentSong.artist.charAt(0)}`);
    if (currentTry >= 5) hints.push(`🎵 Sanatçı: ${currentSong.artist}`);

    return (
      <div className="hints-container" style={{ position: 'relative', overflow: 'hidden' }}>
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

  if (loading || !currentSong) {
    return (
      <main className="game-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="lds-ripple"><div></div><div></div></div>
        <p style={{ marginTop: '20px', color: 'var(--gold-primary)', fontWeight: 'bold', letterSpacing: '1px' }}>Şarkı Yükleniyor...</p>
      </main>
    );
  }

  const isWin = gameStatus === 'won';

  return (
    <main className="game-container">
      <audio
        ref={audioRef}
        src={currentSong.preview}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
      />

      <header className="header">
        <div className="header-icons" onClick={() => window.location.href = '/'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.2rem', lineHeight: 1 }}>SONSUZ</h1>
          {/* <div style={{ fontSize: '0.6rem', color: 'var(--gold-primary)', fontWeight: 800 }}>{category.toUpperCase()} • {difficulty.toUpperCase()}</div> */}
        </div>
        <div className="header-icons" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div className="endless-streak-badge">
            <span className="endless-streak-fire">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 14.5c-.9-1.8-1.1-3.6-.8-5.7 1-.3 1.8-.1 2.3.4.6.6.7 1.4.3 2.7-.4 1.2-.2 2.1.5 2.8s1.6.8 2.6.4c1.1-.4 1.6-1.2 1.6-2.4s-.3-2.2-1-3c-.7-.8-1.5-1.2-2.3-1.3-.8-.1-1.4 0-1.8.4-.4.4-.6 1-.6 1.7 0 .7.2 1.3.5 1.8.3.5.5 1.1.5 1.8s-.4 1.3-1.1 1.8c-.7.5-1.5.7-2.3.7-.8 0-1.5-.2-2.1-.6-.6-.4-1.1-.9-1.4-1.6-.3-.7-.5-1.4-.5-2.2s.3-1.5.8-2.2c.5-.7 1.1-1.3 1.9-1.8.8-.5 1.6-.9 2.5-1.2.9-.3 1.8-.4 2.8-.3 1 .1 1.9.4 2.7.8.8.4 1.5 1 2.1 1.7s1 1.5 1.3 2.5c.3 1 .4 2 .3 3.1-.1 1.1-.4 2.1-1 3.1-.6 1-1.4 1.8-2.4 2.4-1 .6-2.1 1-3.3 1.2-1.2.2-2.4.1-3.6-.2-1.2-.3-2.3-.8-3.3-1.5-1-.7-1.8-1.6-2.4-2.7z" /></svg>
            </span>
            <span className="endless-streak-num">{streak}</span>
          </div>
          {difficulty === 'hard' && (
            <div className="endless-lives">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={`heart ${i >= lives ? 'empty' : ''}`} style={{ fontSize: '1rem' }}>❤️</span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* İstatistik barı */}
      <div className="endless-stats-bar">
        <div className="endless-stat">
          <span className="endless-stat-val">{totalPlayed}</span>
          <span className="endless-stat-label">Oynanan</span>
        </div>
        <div className="endless-stat">
          <span className="endless-stat-val">{totalWins}</span>
          <span className="endless-stat-label">Bilinen</span>
        </div>
        <div className="endless-stat">
          <span className="endless-stat-val">{streak}</span>
          <span className="endless-stat-label">Seri</span>
        </div>
        <div className="endless-stat">
          <span className="endless-stat-val">{bestStreak}</span>
          <span className="endless-stat-label">En İyi</span>
        </div>
      </div>

      {/* İpuçları */}
      {gameStatus === 'playing' && renderHints()}

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
            Tebrikler! Bu kategorideki tüm şarkıları bildin.<br/>
            (Çok da sonsuz değilmiş!)
          </p>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🏆</div>
          <button className="btn btn-submit" onClick={() => window.location.href = '/'} style={{ padding: '15px' }}>
            ANA MENÜYE DÖN
          </button>
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
