import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Returns a problem description if the key is clearly a public (anon/publishable) key. */
function wrongKeyReason(key: string): string | null {
  if (key.startsWith('sb_publishable_')) {
    return 'it is a publishable key';
  }

  if (key.startsWith('sb_secret_')) {
    return null;
  }

  const parts = key.split('.');

  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      );

      if (payload.role && payload.role !== 'service_role') {
        return `its role is "${payload.role}"`;
      }

      return null;
    } catch {
      return 'it resembles a JWT but its payload could not be decoded';
    }
  }

  return 'unrecognized key format';
}

/** Server-side only (API routes). Needs the service_role / secret key, which bypasses RLS. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');

  const bad = wrongKeyReason(key);
  if (bad) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is the wrong key (${bad}). The server loaded a key starting with "${key.slice(0, 16)}" (length ${key.length}). ` +
        `Use the "service_role" key (or "sb_secret_...") from Supabase -> Project Settings -> API. ` +
        `If your .env.local is already correct, a shell variable or .env.development(.local) is overriding it, and the dev server must be restarted.`,
    );
  }

  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}