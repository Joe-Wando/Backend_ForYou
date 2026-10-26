export interface AppConfig {
  port: number;
  /** URL publique du frontend — sert aux URLs de retour NabooPay (success / error). */
  frontendUrl: string;
  /** Origines autorisées par CORS (frontend + dashboard). */
  corsOrigins: string[];
  admin: {
    /** Secret HMAC de signature des jetons de session. */
    sessionSecret: string;
    sessionTtlHours: number;
  };
  naboopay: {
    apiKey: string;
    webhookSecret: string;
    baseUrl: string;
  };
  payment: {
    /** Montant minimum accepté, en XOF (entier). */
    minAmount: number;
    /** Plafond anti-abus, en XOF (entier). */
    maxAmount: number;
    currency: string;
    /** Montants proposés en un clic sur le frontend. */
    suggestedAmounts: number[];
  };
}

/** "a, b,c" → ['a', 'b', 'c'], sans slash final. */
function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function parseIntOr(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export default (): AppConfig => {
  // FRONTEND_URL et DASHBOARD_URL peuvent lister plusieurs adresses (ex. Vercel +
  // localhost) : toutes sont autorisées en CORS, la première de FRONTEND_URL sert
  // aux URLs de retour NabooPay.
  const frontendUrls = parseList(process.env.FRONTEND_URL ?? 'http://localhost:5173');
  const dashboardUrls = parseList(process.env.DASHBOARD_URL ?? 'http://localhost:5174');

  return {
    port: parseIntOr(process.env.PORT, 3000),
    frontendUrl: frontendUrls[0] ?? 'http://localhost:5173',
    corsOrigins: [...frontendUrls, ...dashboardUrls],
    admin: {
      sessionSecret: process.env.ADMIN_SESSION_SECRET ?? '',
      sessionTtlHours: parseIntOr(process.env.ADMIN_SESSION_TTL_HOURS, 12),
    },
    naboopay: {
      apiKey: process.env.NABOOPAY_API_KEY ?? '',
      webhookSecret: process.env.NABOOPAY_WEBHOOK_SECRET ?? '',
      baseUrl: process.env.NABOOPAY_BASE_URL ?? 'https://api.naboopay.com/api/v2',
    },
    payment: {
      minAmount: parseIntOr(process.env.MIN_AMOUNT, 500),
      maxAmount: parseIntOr(process.env.MAX_AMOUNT, 2_000_000),
      currency: process.env.CURRENCY ?? 'XOF',
      suggestedAmounts: (process.env.SUGGESTED_AMOUNTS ?? '2000,5000,10000')
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0),
    },
  };
};
