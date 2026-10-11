import { NextResponse, connection } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { maskStudentId } from '../../../lib/validation';

export async function GET() {
  await connection(); // opt out of build-time prerendering so scores are always fresh
  try {
    const { data, error } = await getSupabase()
      .from('students')
      .select('student_id, name, best_score')
      .gt('best_score', 0)
      .order('best_score', { ascending: false })
      .order('best_score_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('leaderboard error', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    const entries = (data ?? []).map((r) => ({
      name: r.name as string,
      maskedId: maskStudentId(r.student_id as string),
      score: r.best_score as number,
    }));
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('leaderboard error', e);
    return NextResponse.json({ error: 'Server is not configured correctly' }, { status: 500 });
  }
}
