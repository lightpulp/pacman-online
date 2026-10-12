'use client';

import { useState } from 'react';
import type { Student } from '../lib/types';
import { STUDENT_ID_REGEX, cleanName, formatStudentId, isValidName } from '../lib/validation';

interface Props {
  onRegistered: (student: Student) => void;
  onLeaderboard: () => void;
}

export default function RegisterForm({ onRegistered, onLeaderboard }: Props) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  function switchMode() {
    setMode(isLogin ? 'register' : 'login');
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const n = cleanName(name);
    if (!isValidName(n)) return setError('Please enter your name (2-40 characters).');
    if (!STUDENT_ID_REGEX.test(studentId)) return setError('Student ID must look like 00-0000-000.');

    setBusy(true);
    try {
      const res = await fetch(isLogin ? '/api/login' : '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isLogin ? 'Login failed' : 'Registration failed'));
      onRegistered({ studentId: data.studentId, name: data.name, token: data.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
          <img className="brand-hero" src="/brand/msd-shirt.png" alt="MSD – Create, Design, Inspire" />
    <h1 className="title">MSD PAC-MAN</h1>
    <p className="muted center">
      Multimedia &amp; Systems Development
    </p>
      <p className="muted center">{isLogin ? 'Log in with your name and Student ID' : 'Register to play'}</p>

      <label>
        {isLogin ? 'Name (username)' : 'Student Name'}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder="Juan Dela Cruz" />
      </label>

      <label>
        {isLogin ? 'Student ID (password)' : 'Student ID'}
        <input
          value={studentId}
          onChange={(e) => setStudentId(formatStudentId(e.target.value))}
          inputMode="numeric"
          placeholder="00-0000-000"
          maxLength={11}
          autoComplete="off"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="btn primary" disabled={busy}>
        {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Register'}
      </button>
      <button type="button" className="btn link" onClick={switchMode}>
        {isLogin ? 'New here? Register' : 'Already registered? Log in'}
      </button>
      <button type="button" className="btn" onClick={onLeaderboard}>
        View Leaderboard
      </button>
    </form>
  );
}
