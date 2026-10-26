import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MinLength, validateSync } from 'class-validator';

/**
 * Valide les variables d'environnement au démarrage. Si une clé obligatoire
 * manque, l'app refuse de booter avec un message explicite.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsString()
  PORT?: string;

  @IsNotEmpty({ message: 'FRONTEND_URL est obligatoire (CORS + URLs de retour)' })
  @IsString()
  FRONTEND_URL!: string;

  @IsNotEmpty({ message: 'NABOOPAY_API_KEY est obligatoire' })
  @IsString()
  NABOOPAY_API_KEY!: string;

  @IsNotEmpty({ message: 'NABOOPAY_WEBHOOK_SECRET est obligatoire' })
  @IsString()
  NABOOPAY_WEBHOOK_SECRET!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  NABOOPAY_BASE_URL?: string;

  @IsNotEmpty({ message: 'ADMIN_SESSION_SECRET est obligatoire (sessions du dashboard)' })
  @IsString()
  @MinLength(32, { message: 'ADMIN_SESSION_SECRET doit faire au moins 32 caractères' })
  ADMIN_SESSION_SECRET!: string;

  @IsOptional()
  @IsString()
  ADMIN_SESSION_TTL_HOURS?: string;

  @IsOptional()
  @IsString()
  DASHBOARD_URL?: string;

  @IsNotEmpty({ message: 'DATABASE_URL est obligatoire' })
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  MIN_AMOUNT?: string;

  @IsOptional()
  @IsString()
  MAX_AMOUNT?: string;

  @IsOptional()
  @IsString()
  CURRENCY?: string;

  @IsOptional()
  @IsString()
  SUGGESTED_AMOUNTS?: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Configuration invalide :\n  - ${details}`);
  }
  return config;
}
