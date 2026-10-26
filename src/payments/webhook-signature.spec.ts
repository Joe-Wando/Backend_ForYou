import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from './webhook-signature';

describe('verifyWebhookSignature', () => {
  const secret = 'top-secret';
  const rawBody = JSON.stringify({ order_id: 'order_1', transaction_status: 'completed' });
  const goodSig = createHmac('sha256', secret).update(rawBody).digest('hex');

  it('accepte une signature valide', () => {
    expect(verifyWebhookSignature(rawBody, goodSig, secret)).toBe(true);
  });

  it('accepte le préfixe sha256= et la casse majuscule', () => {
    expect(verifyWebhookSignature(rawBody, `sha256=${goodSig.toUpperCase()}`, secret)).toBe(true);
  });

  it('rejette une signature erronée', () => {
    expect(verifyWebhookSignature(rawBody, 'deadbeef', secret)).toBe(false);
  });

  it('rejette si le body a changé', () => {
    expect(verifyWebhookSignature(rawBody + ' ', goodSig, secret)).toBe(false);
  });

  it('rejette une signature ou un secret absents', () => {
    expect(verifyWebhookSignature(rawBody, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(rawBody, goodSig, '')).toBe(false);
  });
});
