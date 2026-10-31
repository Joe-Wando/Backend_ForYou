import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

export interface NaboopayProductLine {
  name: string;
  /** Prix unitaire en XOF. */
  price: number;
  quantity: number;
  description: string;
}

export interface CreateTransactionInput {
  /** Identifiants v2 en minuscules : "wave" | "orange_money". */
  method_of_payment: string[];
  products: NaboopayProductLine[];
  success_url: string;
  error_url: string;
  /** false = les frais sont déduits de ce que reçoit le marchand. */
  fees_customer_side: boolean;
  is_escrow: boolean;
}

export interface NaboopayTransaction {
  order_id: string;
  checkout_url: string;
  transaction_status?: string;
  amount?: number;
  [key: string]: unknown;
}

/**
 * Seul endroit qui connaît la clé API NabooPay. Toute erreur réseau / HTTP
 * est convertie en HttpException avec un message nettoyé — la clé et les
 * en-têtes ne fuient jamais vers le frontend.
 */
@Injectable()
export class NaboopayClient {
  private readonly logger = new Logger(NaboopayClient.name);
  private readonly http: AxiosInstance;

  constructor(config: ConfigService) {
    const baseURL = config.get<string>('naboopay.baseUrl')!;
    const apiKey = config.get<string>('naboopay.apiKey')!;

    this.http = axios.create({
      baseURL,
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async createTransaction(input: CreateTransactionInput): Promise<NaboopayTransaction> {
    return this.request('POST', '/transactions', input);
  }

  async getTransaction(orderId: string): Promise<NaboopayTransaction> {
    return this.request('GET', `/transactions/${encodeURIComponent(orderId)}`);
  }

  async cancelTransaction(orderId: string): Promise<unknown> {
    return this.request('DELETE', `/transactions/${encodeURIComponent(orderId)}`);
  }

  private async request<T = any>(method: string, url: string, data?: unknown): Promise<T> {
    try {
      const res = await this.http.request<T>({ method, url, data });
      return res.data;
    } catch (err) {
      throw this.toHttpException(err, `${method} ${url}`);
    }
  }

  private toHttpException(err: unknown, context: string): HttpException {
    const axErr = err as AxiosError<any>;

    if (axErr.isAxiosError) {
      const status = axErr.response?.status;
      // Log détaillé côté serveur uniquement (jamais renvoyé au client).
      this.logger.error(
        `NabooPay ${context} a échoué (status=${status ?? 'n/a'}): ${
          typeof axErr.response?.data === 'object'
            ? JSON.stringify(axErr.response?.data)
            : axErr.response?.data ?? axErr.message
        }`,
      );

      if (status === undefined) {
        return new HttpException(
          "Le service de paiement est injoignable pour le moment. Merci de réessayer.",
          HttpStatus.BAD_GATEWAY,
        );
      }

      // v2 renvoie { error: "..." } ; message / detail restent pour l'ancien format.
      const providerMessage =
        (axErr.response?.data &&
          (axErr.response.data.error ||
            axErr.response.data.message ||
            axErr.response.data.detail)) ||
        undefined;

      if (status >= 400 && status < 500) {
        return new HttpException(
          providerMessage
            ? `Paiement refusé par NabooPay : ${String(providerMessage)}`
            : 'La demande de paiement a été refusée par NabooPay.',
          HttpStatus.BAD_REQUEST,
        );
      }

      return new HttpException(
        'Le service de paiement rencontre un problème. Merci de réessayer plus tard.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.error(`Erreur inattendue lors de ${context}: ${String(err)}`);
    return new HttpException(
      'Erreur interne lors du traitement du paiement.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
