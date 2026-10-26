import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { NaboopayWebhookPayload } from './dto/naboopay-webhook.dto';
import { PaymentsService } from './payments.service';
import { verifyWebhookSignature } from './webhook-signature';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  /** Paramètres publics de paiement (montant min/max, montants suggérés). */
  @Get('config')
  getConfig() {
    return this.payments.getPublicConfig();
  }

  /** Valide le montant et crée une transaction NabooPay. */
  @Post('checkout')
  async checkout(@Body() dto: CreateCheckoutDto) {
    return this.payments.createCheckout(dto.amount, dto.method);
  }

  /** Statut connu d'une commande (pour polling côté frontend). */
  @Get('status/:orderId')
  async status(@Param('orderId') orderId: string) {
    return this.payments.getStatus(orderId);
  }

  /**
   * Webhook NabooPay (source de vérité). Vérifie la signature HMAC sur le body
   * BRUT, répond 2xx vite, traitement idempotent.
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string | undefined,
    @Body() body: NaboopayWebhookPayload,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Corps de requête illisible.');
    }

    const secret = this.config.get<string>('naboopay.webhookSecret')!;
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Signature du webhook invalide.');
    }

    await this.payments.handleWebhook(body, rawBody.toString('utf8'));
    return { received: true };
  }
}
