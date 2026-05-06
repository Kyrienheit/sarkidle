// Oyunun başlangıç tarihi. GMT+3 (Türkiye Saati)
// Bu tarihten itibaren her gece 00:00'da gameId +1 artar.
const LAUNCH_DATE_MS = new Date('2026-05-06T00:00:00+03:00').getTime();

export function getCurrentGameId() {
  const now = new Date();
  const diffMs = now.getTime() - LAUNCH_DATE_MS;
  const dayIndex = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return dayIndex > 0 ? dayIndex : 1;
}

export function getArchiveDays(currentGameId) {
  const days = [];
  for (let i = 1; i < currentGameId; i++) {
    days.push(i);
  }
  // En yeniden en eskiye sıralayalım
  return days.reverse();
}
