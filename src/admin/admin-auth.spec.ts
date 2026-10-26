import { hashPassword, verifyPassword } from './password';
import { createSessionToken, verifySessionToken } from './session-token';

const SECRET = 'test_secret_au_moins_trente_deux_caracteres';

describe('password', () => {
  it('vérifie le bon mot de passe et rejette un mauvais', async () => {
    const hash = await hashPassword('motdepasse-solide');
    expect(await verifyPassword('motdepasse-solide', hash)).toBe(true);
    expect(await verifyPassword('mauvais', hash)).toBe(false);
  });

  it('rejette un hash mal formé', async () => {
    expect(await verifyPassword('x', 'n-importe-quoi')).toBe(false);
  });
});

describe('session token', () => {
  const exp = Math.floor(Date.now() / 1000) + 60;

  it('accepte un jeton valide', () => {
    const token = createSessionToken({ sub: 'u1', username: 'admin', exp }, SECRET);
    expect(verifySessionToken(token, SECRET)).toEqual({ sub: 'u1', username: 'admin', exp });
  });

  it('rejette un jeton signé avec un autre secret', () => {
    const token = createSessionToken({ sub: 'u1', username: 'admin', exp }, 'autre_secret');
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it('rejette un payload modifié', () => {
    const token = createSessionToken({ sub: 'u1', username: 'admin', exp }, SECRET);
    const forged = Buffer.from(JSON.stringify({ sub: 'u2', username: 'root', exp })).toString(
      'base64url',
    );
    expect(verifySessionToken(`${forged}.${token.split('.')[1]}`, SECRET)).toBeNull();
  });

  it('rejette un jeton expiré', () => {
    const token = createSessionToken({ sub: 'u1', username: 'admin', exp: 1 }, SECRET);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });
});
