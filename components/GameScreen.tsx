'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CANVAS_H, CANVAS_W, Game, type Dir } from '../lib/game/engine';
import { loadAssets } from '../lib/game/assets';
import { sound } from '../lib/game/sound';
import type { Student } from '../lib/types';

type Submit =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; best: number; rank: number; isNewBest: boolean }
  | { status: 'error'; message: string };

interface Props {
  student: Student;
  onExit: () => void;
  onLeaderboard: () => void;
}

export default function GameScreen({ student, onExit, onLeaderboard }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [started, setStarted] = useState(false);
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState({ score: 0, lives: 3 });
  const [result, setResult] = useState<{ score: number; won: boolean } | null>(null);
  const [submit, setSubmit] = useState<Submit>({ status: 'idle' });
  const [muted, setMuted] = useState(false);

  // The score is sent ONCE, after the game ends (never during play).
  const sendScore = useCallback(
    async (score: number, won: boolean) => {
      setSubmit({ status: 'sending' });
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: student.studentId, token: student.token, score, won }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save score');
        setSubmit({ status: 'done', best: data.best, rank: data.rank, isNewBest: data.isNewBest });
      } catch (e) {
        setSubmit({ status: 'error', message: e instanceof Error ? e.message : 'Could not save score' });
      }
    },
    [student],
  );

  // Game loop
  useEffect(() => {
    if (!started) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const game = new Game(
      {
        onSound: (n) => sound.play(n),
        onHud: setHud,
        onFinish: (r) => {
          setResult(r);
          void sendScore(r.score, r.won);
        },
      },
      loadAssets(),
    );
    gameRef.current = game;
    game.start();

    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      game.update(Math.min((t - last) / 1000, 0.05));
      last = t;
      game.render(ctx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      gameRef.current = null;
    };
  }, [started, run, sendScore]);

  // Controls: arrow keys (PC) + swipe (mobile)
  useEffect(() => {
    const keys: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const d = keys[e.key];
      if (!d) return;
      e.preventDefault();
      gameRef.current?.setDir(d);
    };
    window.addEventListener('keydown', onKey);

    const el = wrapRef.current!;
    let sx = 0;
    let sy = 0;
    const onStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault(); // stop page scroll / pull-to-refresh while playing
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
      const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      gameRef.current?.setDir(d);
      sx = t.clientX; // allows chaining several swipes without lifting the finger
      sy = t.clientY;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, []);

  function begin() {
    sound.unlock(); // must happen inside a tap/click for mobile audio
    setStarted(true);
  }

  function playAgain() {
    setHud({ score: 0, lives: 3 });
    setResult(null);
    setSubmit({ status: 'idle' });
    setRun((r) => r + 1);
  }

  function toggleMute() {
    sound.muted = !sound.muted;
    setMuted(sound.muted);
  }

  return (
    <div className="game" ref={wrapRef}>
      <div className="hud">
        <span>SCORE {hud.score}</span>
        <span className="lives">{'●'.repeat(Math.max(hud.lives, 0))}</span>
        <img className="hud-logo" src="/brand/msd-logo.png" alt="MSD" />
        <span className="hud-btns">
          <button onClick={toggleMute} aria-label="Toggle sound">{muted ? '🔇' : '🔊'}</button>
          <button onClick={onExit} aria-label="Quit">✕</button>
        </span>
      </div>

      <div className="board">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />

        {!started && (
          <div className="overlay">
            <img className="brand-logo" src="/brand/msd-logo.png" alt="MSD" />
            <h2 className="title small">READY?</h2>
            <p className="muted">Swipe (mobile) or use arrow keys (PC)</p>
            <button className="btn primary" onClick={begin}>Start Game</button>
          </div>
        )}

        {result && (
          <div className="overlay">
            <p className="muted">CREATE · DESIGN · INSPIRE</p>
            <h2 className="title small">{result.won ? 'YOU WIN!' : 'GAME OVER'}</h2>
            <p className="big">{result.score}</p>
            {submit.status === 'sending' && <p className="muted">Saving score…</p>}
            {submit.status === 'done' && (
              <p>
                {submit.isNewBest ? 'New personal best! ' : ''}Best: {submit.best} · Rank #{submit.rank}
              </p>
            )}
            {submit.status === 'error' && (
              <>
                <p className="error">{submit.message}</p>
                <button className="btn" onClick={() => sendScore(result.score, result.won)}>Retry saving</button>
              </>
            )}
            <button className="btn primary" onClick={playAgain}>Play Again</button>
            <button className="btn" onClick={onLeaderboard}>Leaderboard</button>
            <button className="btn" onClick={onExit}>Menu</button>
          </div>
        )}
      </div>
    </div>
  );
}
