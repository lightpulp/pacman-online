import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { STUDENT_ID_REGEX } from '../../../lib/validation';

const MAX_SCORE = 20000;
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
    const { data, error } = await getSupabase().rpc('submit_score', {
      p_student_id: studentId,
      p_token: token,
      p_score: score,
      p_won: won === true,
    });

    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('invalid_student')) return fail('Student not recognised. Please register again.', 401);
      if (msg.includes('rate_limited')) return fail('Please wait a few seconds before submitting again', 429);
      if (msg.includes('invalid_score')) return fail('Invalid score', 400);
      console.error('score error', error);
      return fail('Could not save score', 500);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ best: row.out_best, isNewBest: row.out_new_best, rank: row.out_rank });
  } catch (e) {
    console.error('score error', e);
    return fail('Server is not configured correctly', 500);
  }
}
