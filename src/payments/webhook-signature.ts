import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Recalcule le HMAC SHA256 (hex) du corps BRUT et le compare à la signature
 * fournie dans l'en-tête `X-Signature`.
 *
 * Important : `rawBody` doit être le buffer exact reçu sur le réseau. Recalculer
 * la signature sur un objet re-sérialisé après JSON.parse donnerait un digest
 * différent (ordre des clés, espaces, encodage des nombres...).
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const payload = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  // Normalise un éventuel préfixe "sha256=" et la casse.
  const received = signatureHeader.trim().replace(/^sha256=/i, '').toLowerCase();

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(received, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, receivedBuf);
}
