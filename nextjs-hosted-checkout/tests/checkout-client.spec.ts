import { describe, expect, it, vi } from 'vitest'

import { requestCheckoutForAttempt } from '@/lib/checkout-client'

describe('requestCheckoutForAttempt', () => {
  it('creates a fresh UUID and retries once after an expired Checkout response', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 409, payload: { code: 'checkout_expired' } })
      .mockResolvedValueOnce({ status: 200, payload: { url: 'https://pay.example/cs_123' } })
    const createAttemptId = vi.fn(() => 'new-attempt')

    await expect(
      requestCheckoutForAttempt({ attemptId: 'old-attempt', request, createAttemptId }),
    ).resolves.toEqual({ attemptId: 'new-attempt', url: 'https://pay.example/cs_123' })

    expect(createAttemptId).toHaveBeenCalledOnce()
    expect(request).toHaveBeenNthCalledWith(1, 'old-attempt')
    expect(request).toHaveBeenNthCalledWith(2, 'new-attempt')
  })
})
