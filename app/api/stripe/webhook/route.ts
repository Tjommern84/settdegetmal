'use server';

import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { stripe, isStripeConfigured } from '../../../../lib/stripe';
import { logError } from '../../../../lib/errorLogger';
import { ENABLE_PAYMENTS } from '../../../../lib/featureFlags';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getSupabaseAdmin = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

export async function POST(request: Request) {
  if (!ENABLE_PAYMENTS || !isStripeConfigured || !stripe) {
    return new Response('Payments disabled', { status: 404 });
  }

  if (!webhookSecret) {
    await logError({
      level: 'error',
      source: 'route',
      context: 'stripe_webhook',
      message: 'Missing webhook secret',
    });
    return new Response('Missing webhook secret', { status: 400 });
  }

  const rawBody = await request.text();
  const signature = headers().get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    await logError({
      level: 'warn',
      source: 'route',
      context: 'stripe_webhook',
      message: error instanceof Error ? error.message : 'Invalid signature',
    });
    return new Response('Invalid signature', { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    await logError({
      level: 'error',
      source: 'route',
      context: 'stripe_webhook',
      message: 'Missing Supabase service key',
    });
    return new Response('Missing Supabase service key', { status: 500 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const serviceId = session.metadata?.service_id;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : null;

      if (serviceId && subscriptionId) {
        await supabaseAdmin
          .from('services')
          .update({
            subscription_status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', serviceId);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from('services')
        .update({
          subscription_status: 'inactive',
        })
        .eq('stripe_subscription_id', subscription.id);
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (subscriptionId) {
        await supabaseAdmin
          .from('services')
          .update({
            subscription_status: 'past_due',
          })
          .eq('stripe_subscription_id', subscriptionId);
      }
    }
  } catch (error) {
    await logError({
      level: 'error',
      source: 'route',
      context: 'stripe_webhook',
      message: error instanceof Error ? error.message : 'Feil i webhook-håndtering',
      stack: error instanceof Error ? error.stack : null,
      metadata: { eventType: event.type },
    });
    return new Response('Webhook failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

