import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const isStripeConfigured = Boolean(stripeSecretKey && stripePriceId);

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    })
  : null;

export const stripeConfig = {
  priceId: stripePriceId,
  appUrl,
};

