import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SessionPayload, verifySessionToken } from './session-token';

export type AdminRequest = Request & { admin: SessionPayload };

/** Protège les routes /admin : exige `Authorization: Bearer <jeton de session>`. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    const payload = token
      ? verifySessionToken(token, this.config.get<string>('admin.sessionSecret')!)
      : null;
    if (!payload) {
      throw new UnauthorizedException('Session expirée ou invalide.');
    }

    req.admin = payload;
    return true;
  }
}
