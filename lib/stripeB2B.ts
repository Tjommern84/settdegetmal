import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_B2B_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_B2B_PRICE_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const isStripeB2BConfigured = Boolean(stripeSecretKey && stripePriceId);

export const stripeB2B = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    })
  : null;

export const stripeB2BConfig = {
  priceId: stripePriceId,
  appUrl,
};
