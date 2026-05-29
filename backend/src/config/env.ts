import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  databaseUrl: process.env.DATABASE_URL,
  printfulApiKey: process.env.PRINTFUL_API_KEY,
  printfulStoreId: process.env.PRINTFUL_STORE_ID,
  printfulSellingRegion: process.env.PRINTFUL_SELLING_REGION || 'north_america',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiDesignModel: process.env.OPENAI_DESIGN_MODEL || 'gpt-image-1',
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || 'gpt-5-nano',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  targetMarginPercent: numberFromEnv('TARGET_MARGIN_PERCENT', 30),
  minMarginCents: numberFromEnv('MIN_MARGIN_CENTS', 500),
  aiDesignFeeCents: numberFromEnv('AI_DESIGN_FEE_CENTS', 300),
  paymentFeePercent: numberFromEnv('PAYMENT_FEE_PERCENT', 2.9),
  paymentFeeFixedCents: numberFromEnv('PAYMENT_FEE_FIXED_CENTS', 30),
};
