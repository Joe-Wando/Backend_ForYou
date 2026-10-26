import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody:true expose req.rawBody (Buffer) — indispensable pour vérifier
  // la signature HMAC du webhook NabooPay sur le corps exact reçu.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    methods: ['GET', 'POST', 'OPTIONS'],
    // ngrok-skip-browser-warning : envoyé par les frontends quand l'API passe par ngrok gratuit.
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  Logger.log(`Backend prêt sur http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
