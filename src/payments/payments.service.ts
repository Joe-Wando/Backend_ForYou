import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NaboopayWebhookPayload } from './dto/naboopay-webhook.dto';
import type { PaymentMethod } from './dto/create-checkout.dto';
import { NaboopayClient } from './naboopay.client';

interface PaymentConfig {
  minAmount: number;
  maxAmount: number;
  currency: string;
  suggestedAmounts: number[];
}

export interface CheckoutResult {
  checkout_url: string;
  order_id: string;
}

export interface OrderStatus {
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string | null;
  updatedAt: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly naboopay: NaboopayClient,
    private readonly config: ConfigService,
  ) {}

  private get paymentConfig(): PaymentConfig {
    return this.config.get<PaymentConfig>('payment')!;
  }

  getPublicConfig() {
    const { minAmount, maxAmount, currency, suggestedAmounts } = this.paymentConfig;
    return { minAmount, maxAmount, currency, suggestedAmounts };
  }

  async createCheckout(amount: number, method: PaymentMethod): Promise<CheckoutResult> {
    const { minAmount, maxAmount, currency } = this.paymentConfig;

    // Revalidation serveur — le montant vient du client, on ne lui fait pas confiance.
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Montant invalide.');
    }
    if (amount < minAmount) {
      throw new BadRequestException(
        `Le montant minimum est de ${minAmount.toLocaleString('fr-FR')} F CFA.`,
      );
    }
    if (amount > maxAmount) {
      throw new BadRequestException(
        `Le montant maximum est de ${maxAmount.toLocaleString('fr-FR')} F CFA.`,
      );
    }

    const frontendUrl = this.config.get<string>('frontendUrl')!.replace(/\/$/, '');

    const transaction = await this.naboopay.createTransaction({
      method_of_payment: [method],
      products: [
        {
          name: 'Contribution For you',
          category: 'Soutien',
          amount,
          quantity: 1,
          description: 'Contribution libre via For you',
        },
      ],
      success_url: `${frontendUrl}/success`,
      error_url: `${frontendUrl}/error`,
      is_escrow: false,
    });

    if (!transaction?.order_id || !transaction?.checkout_url) {
      this.logger.error(`Réponse NabooPay inattendue : ${JSON.stringify(transaction)}`);
      throw new BadRequestException("NabooPay n'a pas renvoyé de lien de paiement.");
    }

    await this.prisma.order.create({
      data: {
        orderId: transaction.order_id,
        status: 'pending',
        amount,
        currency,
        method,
        checkoutUrl: transaction.checkout_url,
      },
    });

    return { checkout_url: transaction.checkout_url, order_id: transaction.order_id };
  }

  async getStatus(orderId: string): Promise<OrderStatus> {
    let order = await this.prisma.order.findUnique({ where: { orderId } });
    if (!order) {
      throw new NotFoundException(`Commande "${orderId}" introuvable.`);
    }

    if (order.status === 'pending') {
      try {
        const remote = await this.naboopay.getTransaction(orderId);
        const remoteStatus = this.normalizeStatus(remote?.transaction_status);
        if (remoteStatus && remoteStatus !== order.status) {
          order = await this.prisma.order.update({
            where: { orderId },
            data: {
              status: remoteStatus,
              paidAt: remoteStatus === 'completed' ? new Date() : order.paidAt,
            },
          });
        }
      } catch (err) {
        this.logger.warn(`Rafraîchissement du statut ${orderId} impossible : ${String(err)}`);
      }
    }

    return this.toStatusDto(order);
  }

  /**
   * Traite un webhook NabooPay dont la signature a DÉJÀ été vérifiée par le
   * contrôleur. Idempotent grâce à la contrainte unique (orderId, status).
   */
  async handleWebhook(payload: NaboopayWebhookPayload, rawBody: string): Promise<void> {
    const orderId = payload.order_id;
    const status = this.normalizeStatus(payload.transaction_status) ?? 'unknown';

    if (!orderId) {
      this.logger.warn('Webhook reçu sans order_id, ignoré.');
      return;
    }

    try {
      await this.prisma.webhookEvent.create({ data: { orderId, status, payload: rawBody } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`Webhook déjà traité (${orderId} / ${status}), ignoré.`);
        return;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        this.logger.warn(`Webhook pour une commande inconnue (${orderId}), ignoré.`);
        return;
      }
      throw err;
    }

    const customerName = [payload.customer?.first_name, payload.customer?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    await this.prisma.order.update({
      where: { orderId },
      data: {
        status,
        fees: typeof payload.fees === 'number' ? payload.fees : undefined,
        customerName: customerName || undefined,
        customerPhone: payload.customer?.phone || undefined,
        paidAt: payload.paid_at
          ? new Date(payload.paid_at)
          : status === 'completed'
            ? new Date()
            : undefined,
      },
    });

    this.logger.log(`Commande ${orderId} → ${status}`);
  }

  private normalizeStatus(status: string | undefined | null): string | null {
    if (!status) return null;
    return String(status).toLowerCase().trim();
  }

  private toStatusDto(order: {
    orderId: string;
    status: string;
    amount: number;
    currency: string;
    method: string;
    paidAt: Date | null;
    updatedAt: Date;
  }): OrderStatus {
    return {
      order_id: order.orderId,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      method: order.method,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
