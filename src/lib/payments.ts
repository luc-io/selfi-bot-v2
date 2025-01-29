import { prisma } from './prisma';
import { logger } from './logger';
import { updateUserStars } from './user';
import { config } from '../config';
import type { PreCheckoutQuery, SuccessfulPayment } from 'grammy/types';

interface StarProduct {
  id: string;
  stars: number;
  amount: number; // in cents
  description: string;
}

// Star packages
export const STAR_PRODUCTS: StarProduct[] = [
  {
    id: 'stars_100',
    stars: 100,
    amount: 199, // $1.99
    description: '100 ⭐ Stars - Great for trying out!'
  },
  {
    id: 'stars_500',
    stars: 500,
    amount: 499, // $4.99
    description: '500 ⭐ Stars - Most popular!'
  },
  {
    id: 'stars_1200',
    stars: 1200,
    amount: 999, // $9.99
    description: '1200 ⭐ Stars - Best value!'
  }
];

// Create invoice
export function createStarInvoice(productId: string) {
  const product = STAR_PRODUCTS.find(p => p.id === productId);
  if (!product) {
    throw new Error('Invalid product ID');
  }

  return {
    title: `${product.stars} Stars`,
    description: product.description,
    payload: product.id,
    provider_token: config.TELEGRAM_PAYMENT_TOKEN,
    currency: 'USD',
    prices: [{
      label: `${product.stars} Stars`,
      amount: product.amount
    }],
    // Only allow purchases through saved payment methods
    need_shipping_address: false,
    is_flexible: false,
    // Start parameter for deep linking
    start_parameter: `buy_${product.id}`
  };
}

// Handle pre-checkout query
export async function handlePreCheckoutQuery(query: PreCheckoutQuery) {
  try {
    const { id: queryId, from: user, invoice_payload: productId } = query;
    logger.info({ queryId, userId: user.id, productId }, 'Processing pre-checkout');

    // Validate product
    const product = STAR_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      logger.error({ queryId, productId }, 'Invalid product ID');
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in pre-checkout:', error);
    return false;
  }
}

// Handle successful payment
export async function handleSuccessfulPayment(payment: SuccessfulPayment, userId: string) {
  try {
    const { 
      provider_payment_charge_id: chargeId,
      invoice_payload: productId,
      total_amount: amount,
      currency
    } = payment;

    logger.info({ 
      chargeId, 
      productId, 
      amount, 
      currency,
      userId 
    }, 'Processing successful payment');

    // Validate product
    const product = STAR_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      throw new Error('Invalid product ID');
    }

    // Create payment and update stars
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          userId,
          amount: amount / 100, // Convert from cents
          currency,
          telegramPaymentChargeId: chargeId,
          starsGranted: product.stars
        }
      });

      // Update user's stars
      const { user, transaction } = await updateUserStars(
        userId,
        product.stars,
        'PURCHASE'
      );

      return { payment, user, transaction };
    });

    logger.info({ 
      userId,
      paymentId: result.payment.id,
      stars: product.stars 
    }, 'Payment processed successfully');

    return result;
  } catch (error) {
    logger.error('Error processing payment:', error);
    throw error;
  }
}