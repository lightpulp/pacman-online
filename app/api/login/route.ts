import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { STUDENT_ID_REGEX, cleanName } from '../../../lib/validation';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const norm = (s: string) => cleanName(s).toLowerCase();

/** "Username" = student name, "password" = Student ID. Returns the same token the student got at registration. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail('Invalid request', 400);
  }

  const name = cleanName(body.name);
  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
  if (!name) return fail('Please enter your name', 400);
  if (!STUDENT_ID_REGEX.test(studentId)) return fail('Student ID must look like 00-0000-000', 400);

  try {
    const { data, error } = await getSupabase()
      .from('students')
      .select('student_id, name, token')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error('login error', error);
      return fail(`Database error: ${error.message}`, 500);
    }
    if (!data || norm(data.name as string) !== norm(name)) {
      return fail('Name and Student ID do not match', 401);
    }
    return NextResponse.json({ studentId: data.student_id, name: data.name, token: data.token });
  } catch (e) {
    console.error('login error', e);
    return fail('Server is not configured correctly', 500);
  }
}
