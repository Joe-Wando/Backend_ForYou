import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthGuard, type AdminRequest } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  /** Identifiant + mot de passe → jeton de session signé. */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.username, dto.password, req.ip ?? 'unknown');
  }

  /** Vérifie la session courante (utilisé au chargement du dashboard). */
  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: AdminRequest) {
    return { username: req.admin.username, expiresAt: new Date(req.admin.exp * 1000).toISOString() };
  }
}
