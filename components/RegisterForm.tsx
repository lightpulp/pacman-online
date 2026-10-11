'use client';

import { useState } from 'react';
import type { Student } from '../lib/types';
import { STUDENT_ID_REGEX, cleanName, formatStudentId, isValidName } from '../lib/validation';

interface Props {
  onRegistered: (student: Student) => void;
  onLeaderboard: () => void;
}

export default function RegisterForm({ onRegistered, onLeaderboard }: Props) {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const n = cleanName(name);
    if (!isValidName(n)) return setError('Please enter your name (2-40 characters).');
    if (!STUDENT_ID_REGEX.test(studentId)) return setError('Student ID must look like 00-0000-000.');

    setBusy(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      onRegistered({ studentId: data.studentId, name: data.name, token: data.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h1 className="title">PAC-MAN</h1>
      <p className="muted center">Register to play</p>

      <label>
        Student Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder="Juan Dela Cruz" />
      </label>

      <label>
        Student ID
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
        {busy ? 'Registering…' : 'Register'}
      </button>
      <button type="button" className="btn" onClick={onLeaderboard}>
        View Leaderboard
      </button>
    </form>
  );
}
