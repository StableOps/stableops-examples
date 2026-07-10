import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    createCheckoutForAttempt: vi.fn(),
  }
})

vi.mock('@/lib/checkout', () => ({
  createCheckoutForAttempt: mocks.createCheckoutForAttempt,
  CheckoutAttemptExpiredError: class CheckoutAttemptExpiredError extends Error {},
}))
vi.mock('@/lib/orders', () => ({ orderStore: {} }))
vi.mock('@/lib/stableops', () => ({ createStableOpsCheckout: vi.fn() }))

import { POST } from '@/app/api/checkout/route'

describe('POST /api/checkout', () => {
  beforeEach(() => {
    delete process.env.APP_URL
    mocks.createCheckoutForAttempt.mockReset()
  })

  it('returns a 400 JSON response for a non-UUID attemptId', async () => {
    const response = await POST(
      new Request('https://shop.example/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId: 'not-a-uuid' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({ error: 'attemptId 必须是有效的 UUID。' })
  })

  it('returns a 400 JSON response for invalid JSON', async () => {
    const response = await POST(
      new Request('https://shop.example/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({ error: '请求体必须是 JSON。' })
  })

  it('returns a 400 JSON response when attemptId is missing', async () => {
    const response = await POST(
      new Request('https://shop.example/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'attemptId 必须是有效的 UUID。' })
  })

  it('uses only the configured APP_URL origin for Checkout return URLs', async () => {
    process.env.APP_URL = 'https://configured.example/a/path?ignored=yes'
    mocks.createCheckoutForAttempt.mockResolvedValue({ url: 'https://pay.example/cs_123' })
    const attemptId = 'b30a4c0e-a414-4f9d-8d2b-030d47cf532c'

    const response = await POST(
      new Request('https://attacker.example/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: 'attacker.example' },
        body: JSON.stringify({ attemptId }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.createCheckoutForAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId, origin: 'https://configured.example' }),
    )
  })

  it('returns a clear 400 when APP_URL is missing or invalid', async () => {
    const request = () =>
      new Request('https://shop.example/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId: 'b30a4c0e-a414-4f9d-8d2b-030d47cf532c' }),
      })

    const missing = await POST(request())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'APP_URL 必须是有效的绝对 URL。' })

    process.env.APP_URL = 'not a url'
    const invalid = await POST(request())
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ error: 'APP_URL 必须是有效的绝对 URL。' })
  })

  it('returns 409 for an expired attempt so the client can generate a new UUID', async () => {
    process.env.APP_URL = 'https://shop.example'
    mocks.createCheckoutForAttempt.mockRejectedValue(Object.assign(new Error(), { code: 'checkout_expired' }))

    const response = await POST(
      new Request('https://shop.example/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId: 'b30a4c0e-a414-4f9d-8d2b-030d47cf532c' }),
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: '该 Checkout 已过期，请重试。', code: 'checkout_expired' })
  })
})
