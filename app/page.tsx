'use client';

import { useEffect, useState } from 'react';
import RegisterForm from '../components/RegisterForm';
import GameScreen from '../components/GameScreen';
import Leaderboard from '../components/Leaderboard';
import type { Student } from '../lib/types';

const STORAGE_KEY = 'pacman_student';
type Screen = 'loading' | 'register' | 'menu' | 'game' | 'leaderboard';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Student;
        if (s.studentId && s.name && s.token) {
          setStudent(s);
          setScreen('menu');
          return;
        }
      }
    } catch {
      /* ignore corrupted storage */
    }
    setScreen('register');
  }, []);

  function handleRegistered(s: Student) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setStudent(s);
    setScreen('menu');
  }

  function notYou() {
    localStorage.removeItem(STORAGE_KEY);
    setStudent(null);
    setScreen('register');
  }

  if (screen === 'loading') return <main className="screen" />;

  if (screen === 'game' && student) {
    return (
      <GameScreen student={student} onExit={() => setScreen('menu')} onLeaderboard={() => setScreen('leaderboard')} />
    );
  }

  return (
    <main className="screen">
      {screen === 'register' && (
        <RegisterForm onRegistered={handleRegistered} onLeaderboard={() => setScreen('leaderboard')} />
      )}

      {screen === 'menu' && student && (
        <div className="card">
          <h1 className="title">PAC-MAN</h1>
          <p className="center">
            Welcome, <strong>{student.name}</strong>
            <br />
            <small className="muted">{student.studentId.slice(0, 8)}***</small>
          </p>
          <button className="btn primary" onClick={() => setScreen('game')}>Play</button>
          <button className="btn" onClick={() => setScreen('leaderboard')}>Leaderboard</button>
          <button className="btn link" onClick={notYou}>Not you?</button>
        </div>
      )}

      {screen === 'leaderboard' && <Leaderboard onBack={() => setScreen(student ? 'menu' : 'register')} />}
    </main>
  );
}
