import { IsIn, IsInt, IsPositive, Max } from 'class-validator';

export const PAYMENT_METHODS = ['WAVE', 'ORANGE_MONEY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class CreateCheckoutDto {
  /**
   * Montant en F CFA saisi par le client. Revalidé côté service contre
   * MIN_AMOUNT / MAX_AMOUNT — ne jamais faire confiance au frontend.
   */
  @IsInt({ message: 'Le montant doit être un nombre entier (F CFA, sans centimes).' })
  @IsPositive({ message: 'Le montant doit être positif.' })
  @Max(100_000_000, { message: 'Montant trop élevé.' })
  amount!: number;

  @IsIn(PAYMENT_METHODS, { message: 'Moyen de paiement invalide.' })
  method!: PaymentMethod;
}
