import type { CreateCheckoutSessionInput } from '@stableops/api-sdk'

import type { Store } from '@/lib/types'

type CreateSession = (input: CreateCheckoutSessionInput & { idempotencyKey: string }) => Promise<{
  paymentOrderId: string
  url: string
}>

export class CheckoutAttemptExpiredError extends Error {
  readonly code = 'checkout_expired'

  constructor() {
    super('该 Checkout 已过期，请使用新的 attemptId 重试。')
    this.name = 'CheckoutAttemptExpiredError'
  }
}

export async function createCheckoutForAttempt({
  attemptId,
  origin,
  store,
  createSession,
  now = new Date(),
}: {
  attemptId: string
  origin: string
  store: Store
  createSession: CreateSession
  now?: Date
}): Promise<{ url: string }> {
  let order = await store.find(attemptId)

  if (!order) {
    const checkoutExpiresAt = new Date(now.getTime() + 30 * 60 * 1000)
    try {
      order = await store.create(attemptId, checkoutExpiresAt)
    } catch (error) {
      order = await store.find(attemptId)
      if (!order) throw error
    }
  }

  if (order.checkoutExpiresAt.getTime() <= now.getTime()) {
    throw new CheckoutAttemptExpiredError()
  }

  if (order.checkoutUrl) return { url: order.checkoutUrl }

  const resultBaseUrl = `${origin}/payment/result?order=${encodeURIComponent(attemptId)}`
  const checkout = await createSession({
    merchantOrderId: attemptId,
    idempotencyKey: attemptId,
    amount: '0.01',
    amountMode: 'auto',
    acceptedAssets: [{ chain: 'base-sepolia', asset: 'USDC' }],
    expiresAt: order.checkoutExpiresAt.toISOString(),
    title: 'Next.js USDC demo',
    successUrl: `${resultBaseUrl}&result=success`,
    cancelUrl: `${resultBaseUrl}&result=cancel`,
  })

  await store.saveCheckout(attemptId, checkout.paymentOrderId, checkout.url)
  return { url: checkout.url }
}
