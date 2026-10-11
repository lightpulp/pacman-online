import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { STUDENT_ID_REGEX } from '../../../lib/validation';

const MAX_SCORE = 20000;
const COOLDOWN_MS = 20_000;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail('Invalid request', 400);
  }

  const { studentId, token, score, won } = body;
  if (typeof studentId !== 'string' || !STUDENT_ID_REGEX.test(studentId)) return fail('Invalid student', 400);
  if (typeof token !== 'string' || token.length < 30 || token.length > 40) return fail('Invalid token', 401);
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > MAX_SCORE || score % 10 !== 0) {
    return fail('Invalid score', 400);
  }

  try {
    const sb = getSupabase();

    // 1. Who is this, and is the token right?
    const { data: student, error: e1 } = await sb
      .from('students')
      .select('student_id, token, best_score')
      .eq('student_id', studentId)
      .maybeSingle();
    if (e1) {
      console.error('score: student lookup failed', e1);
      return fail(`Database error (student lookup): ${e1.message}`, 500);
    }
    if (!student || String(student.token).toLowerCase() !== token.toLowerCase()) {
      return fail('Student not recognised. Please log in again.', 401);
    }

    // 2. Basic rate limit
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { count, error: e2 } = await sb
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('created_at', since);
    if (e2) {
      console.error('score: rate-limit check failed', e2);
      return fail(`Database error (scores read): ${e2.message}`, 500);
    }
    if ((count ?? 0) > 0) return fail('Please wait a few seconds before submitting again', 429);

    // 3. Save the attempt
    const { error: e3 } = await sb.from('scores').insert({ student_id: studentId, score, won: won === true });
    if (e3) {
      console.error('score: insert failed', e3);
      return fail(`Database error (scores insert): ${e3.message}`, 500);
    }

    // 4. Update best score if beaten
    let best = student.best_score as number;
    let isNewBest = false;
    if (score > best) {
      const { error: e4 } = await sb
        .from('students')
        .update({ best_score: score, best_score_at: new Date().toISOString() })
        .eq('student_id', studentId);
      if (e4) {
        console.error('score: best update failed', e4);
        return fail(`Database error (best score update): ${e4.message}`, 500);
      }
      best = score;
      isNewBest = true;
    }

    // 5. Rank
    const { count: higher } = await sb
      .from('students')
      .select('student_id', { count: 'exact', head: true })
      .gt('best_score', best);

    return NextResponse.json({ best, isNewBest, rank: (higher ?? 0) + 1 });
  } catch (e) {
    console.error('score error', e);
    return fail('Server is not configured correctly', 500);
  }
}
