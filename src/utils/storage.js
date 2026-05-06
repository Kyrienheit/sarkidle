export function loadGameState() {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('sarkidle_state');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return { 
    history: {}, // { "1": { status: "win", attempts: 3 }, "2": { status: "loss", attempts: 5 } }
    stats: { played: 0, wins: 0, currentStreak: 0, maxStreak: 0 } 
  };
}

export function saveGameState(state) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sarkidle_state', JSON.stringify(state));
}
