import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { STUDENT_ID_REGEX, cleanName, isValidName } from '../../../lib/validation';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail('Invalid request', 400);
  }

  const name = cleanName(body.name);
  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';

  if (!isValidName(name)) return fail('Name must be 2-40 characters', 400);
  if (!STUDENT_ID_REGEX.test(studentId)) return fail('Student ID must look like 00-0000-000', 400);

  try {
    const { data, error } = await getSupabase()
      .from('students')
      .insert({ student_id: studentId, name })
      .select('token')
      .single();

    if (error) {
      if (error.code === '23505') return fail('This Student ID is already registered', 409);
      console.error('register error', error);
      return fail('Could not register right now', 500);
    }
    return NextResponse.json({ studentId, name, token: data.token }, { status: 201 });
  } catch (e) {
    console.error('register error', e);
    return fail('Server is not configured correctly', 500);
  }
}
