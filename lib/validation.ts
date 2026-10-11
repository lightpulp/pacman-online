export const STUDENT_ID_REGEX = /^\d{2}-\d{4}-\d{3}$/;

/** Turns any typed input into the 00-0000-000 shape as the user types. */
export function formatStudentId(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
}

export function cleanName(input: unknown): string {
  return typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
}

export function isValidName(name: string): boolean {
  return name.length >= 2 && name.length <= 40;
}

/** 00-0000-123 -> 00-0000-*** */
export function maskStudentId(id: string): string {
  return `${id.slice(0, 8)}***`;
}
