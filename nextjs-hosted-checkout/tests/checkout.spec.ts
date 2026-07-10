import { describe, expect, it, vi } from 'vitest'

import { CheckoutAttemptExpiredError, createCheckoutForAttempt } from '@/lib/checkout'
import type { Store, StoredOrder } from '@/lib/types'

function createStore(initialOrder?: StoredOrder): Store & {
  readonly create: ReturnType<typeof vi.fn>
  readonly saveCheckout: ReturnType<typeof vi.fn>
} {
  let order = initialOrder

  const store: Store = {
    find: vi.fn(async () => order ?? null),
    create: vi.fn(async (id: string, checkoutExpiresAt: Date) => {
      order = { id, checkoutUrl: null, checkoutExpiresAt }
      return order
    }),
    saveCheckout: vi.fn(async (id: string, stableOpsOrderId: string, checkoutUrl: string) => {
      if (!order || order.id !== id) throw new Error('订单不存在')
      order = { ...order, stableOpsOrderId, checkoutUrl }
      return order
    }),
  }

  return Object.assign(store, {
    create: store.create as ReturnType<typeof vi.fn>,
    saveCheckout: store.saveCheckout as ReturnType<typeof vi.fn>,
  })
}

describe('createCheckoutForAttempt', () => {
  it('uses the stable attempt ID for the merchant order and idempotency key', async () => {
    const store = createStore()
    const createSession = vi.fn(async () => ({
      paymentOrderId: 'po_123',
      url: 'https://pay.example/cs_123',
    }))

    await createCheckoutForAttempt({
      attemptId: 'a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e',
      origin: 'https://shop.example',
      store,
      createSession,
      now: new Date('2026-07-10T00:00:00.000Z'),
    })

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantOrderId: 'a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e',
        idempotencyKey: 'a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e',
        amount: '0.01',
        amountMode: 'auto',
        acceptedAssets: [{ chain: 'base-sepolia', asset: 'USDC' }],
        title: 'Next.js USDC demo',
        successUrl:
          'https://shop.example/payment/result?order=a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e&result=success',
        cancelUrl:
          'https://shop.example/payment/result?order=a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e&result=cancel',
      }),
    )
  })

  it('reuses the persisted expiry time for checkout-session retries', async () => {
    const expiresAt = new Date('2026-07-10T00:30:00.000Z')
    const store = createStore({ id: 'attempt-1', checkoutUrl: null, checkoutExpiresAt: expiresAt })
    const createSession = vi.fn(async () => ({
      paymentOrderId: 'po_123',
      url: 'https://pay.example/cs_123',
    }))

    await createCheckoutForAttempt({
      attemptId: 'attempt-1',
      origin: 'https://shop.example',
      store,
      createSession,
      now: new Date('2026-07-10T00:10:00.000Z'),
    })

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: expiresAt.toISOString() }),
    )
  })

  it('returns an unexpired checkout URL without calling StableOps', async () => {
    const store = createStore({
      id: 'attempt-1',
      stableOpsOrderId: 'po_123',
      checkoutUrl: 'https://pay.example/cs_123',
      checkoutExpiresAt: new Date('2026-07-10T00:30:00.000Z'),
    })
    const createSession = vi.fn()

    const result = await createCheckoutForAttempt({
      attemptId: 'attempt-1',
      origin: 'https://shop.example',
      store,
      createSession,
      now: new Date('2026-07-10T00:00:00.000Z'),
    })

    expect(result).toEqual({ url: 'https://pay.example/cs_123' })
    expect(createSession).not.toHaveBeenCalled()
  })

  it('rejects an expired checkout attempt instead of returning its persisted URL', async () => {
    const store = createStore({
      id: 'attempt-1',
      stableOpsOrderId: 'po_123',
      checkoutUrl: 'https://pay.example/cs_expired',
      checkoutExpiresAt: new Date('2026-07-10T00:30:00.000Z'),
    })
    const createSession = vi.fn()

    await expect(
      createCheckoutForAttempt({
        attemptId: 'attempt-1',
        origin: 'https://shop.example',
        store,
        createSession,
        now: new Date('2026-07-10T00:30:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(CheckoutAttemptExpiredError)

    expect(createSession).not.toHaveBeenCalled()
  })

  it('recovers from a unique-create conflict and uses the winner order expiry', async () => {
    const expiresAt = new Date('2026-07-10T00:30:00.000Z')
    const winnerOrder: StoredOrder = {
      id: 'attempt-1',
      checkoutUrl: null,
      checkoutExpiresAt: expiresAt,
    }
    const store: Store = {
      find: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winnerOrder),
      create: vi.fn(async () => {
        throw new Error('Unique constraint failed on the fields: (`id`)')
      }),
      saveCheckout: vi.fn(async (id, stableOpsOrderId, checkoutUrl) => ({
        ...winnerOrder,
        id,
        stableOpsOrderId,
        checkoutUrl,
      })),
    }
    const createSession = vi.fn(async () => ({
      paymentOrderId: 'po_123',
      url: 'https://pay.example/cs_123',
    }))

    await createCheckoutForAttempt({
      attemptId: 'attempt-1',
      origin: 'https://shop.example',
      store,
      createSession,
      now: new Date('2026-07-10T00:10:00.000Z'),
    })

    expect(store.find).toHaveBeenCalledTimes(2)
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: expiresAt.toISOString() }),
    )
  })

  it('passes walletConnectProjectId to the checkout session when provided', async () => {
    const store = createStore()
    const createSession = vi.fn(async () => ({
      paymentOrderId: 'po_123',
      url: 'https://pay.example/cs_123',
    }))

    await createCheckoutForAttempt({
      attemptId: 'a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e',
      origin: 'https://shop.example',
      store,
      createSession,
      walletConnectProjectId: 'test-project-id',
      now: new Date('2026-07-10T00:00:00.000Z'),
    })

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ walletConnectProjectId: 'test-project-id' }),
    )
  })

  it('omits walletConnectProjectId when not provided', async () => {
    const store = createStore()
    const createSession = vi.fn(async () => ({
      paymentOrderId: 'po_123',
      url: 'https://pay.example/cs_123',
    }))

    await createCheckoutForAttempt({
      attemptId: 'a0f32a2a-32f3-4d95-8ccf-5f2b5d8b8c1e',
      origin: 'https://shop.example',
      store,
      createSession,
      now: new Date('2026-07-10T00:00:00.000Z'),
    })

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ walletConnectProjectId: undefined }),
    )
  })
})
