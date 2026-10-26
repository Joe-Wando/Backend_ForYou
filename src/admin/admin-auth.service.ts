import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './password';
import { createSessionToken } from './session-token';

export interface LoginResult {
  token: string;
  username: string;
  expiresAt: string;
}

const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AdminAuthService {
  /** Échecs de connexion récents par IP (mémoire du process : suffisant pour une instance unique). */
  private readonly failures = new Map<string, { count: number; first: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string, ip: string): Promise<LoginResult> {
    this.assertNotLocked(ip);

    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      this.recordFailure(ip);
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    }

    this.failures.delete(ip);
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const ttl = this.config.get<number>('admin.sessionTtlHours')!;
    const exp = Math.floor(Date.now() / 1000) + ttl * 3600;
    const token = createSessionToken(
      { sub: user.id, username: user.username, exp },
      this.config.get<string>('admin.sessionSecret')!,
    );

    return { token, username: user.username, expiresAt: new Date(exp * 1000).toISOString() };
  }

  private assertNotLocked(ip: string): void {
    const entry = this.failures.get(ip);
    if (!entry) return;
    if (Date.now() - entry.first > LOCK_WINDOW_MS) {
      this.failures.delete(ip);
      return;
    }
    if (entry.count >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Trop de tentatives. Réessayez dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(ip: string): void {
    const entry = this.failures.get(ip);
    if (entry && Date.now() - entry.first <= LOCK_WINDOW_MS) entry.count += 1;
    else this.failures.set(ip, { count: 1, first: Date.now() });
  }
}
