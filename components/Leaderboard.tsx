'use client';

import { useCallback, useEffect, useState } from 'react';

interface Entry {
  name: string;
  maskedId: string;
  score: number;
}

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card">
      <h1 className="title small">TOP 10</h1>

      {error && <p className="error">{error}</p>}
      {!entries && !error && <p className="muted center">Loading…</p>}
      {entries && entries.length === 0 && <p className="muted center">No scores yet. Be the first!</p>}

      {entries && entries.length > 0 && (
        <ol className="board-list">
          {entries.map((e, i) => (
            <li key={e.maskedId + i}>
              <span className="rank">{i + 1}</span>
              <span className="who">
                <strong>{e.name}</strong>
                <small>{e.maskedId}</small>
              </span>
              <span className="pts">{e.score}</span>
            </li>
          ))}
        </ol>
      )}

      <button className="btn" onClick={load}>Refresh</button>
      <button className="btn primary" onClick={onBack}>Back</button>
    </div>
  );
}
