import { createHmac, timingSafeEqual } from 'crypto';

export interface SessionPayload {
  /** id de l'AdminUser */
  sub: string;
  username: string;
  /** expiration, en secondes depuis l'epoch */
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Jeton `<payload base64url>.<HMAC-SHA256 base64url>` — un JWT minimal, sans dépendance. */
export function createSessionToken(payload: SessionPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

/** Renvoie le payload si la signature est valide et le jeton non expiré, sinon null. */
export function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
