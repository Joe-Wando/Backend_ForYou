/**
 * Forme du payload webhook NabooPay. On ne valide PAS avec class-validator :
 * l'authenticité vient de la signature HMAC (webhook-signature.ts), pas de la
 * forme du corps. Ce type sert juste au confort de développement.
 */
export interface NaboopayWebhookPayload {
  order_id: string;
  method_of_payment?: string[];
  selected_payment_method?: string;
  amount: number;
  fees?: number;
  currency?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    created_at?: string;
  };
  transaction_status: string;
  products?: Array<Record<string, unknown>>;
  is_escrow?: boolean;
  created_at?: string;
  updated_at?: string;
  paid_at?: string | null;
}
