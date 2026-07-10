import { buildSignatureHeader, EVENT_ID_HEADER, SIGNATURE_HEADER } from '@stableops/api-sdk/webhooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordAndApply = vi.hoisted(() => vi.fn())

vi.mock('@/lib/orders', () => ({ webhookStore: { recordAndApply } }))

import { POST } from '@/app/api/webhooks/stableops/route'
import { applyWebhookEvent } from '@/lib/webhook'

const secret = 'whsec_test'

function signedRequest(rawBody: string, eventId = 'evt_123'): Request {
  return new Request('https://merchant.example/api/webhooks/stableops', {
    method: 'POST',
    headers: {
      [SIGNATURE_HEADER]: buildSignatureHeader({
        secret,
        timestamp: Math.floor(Date.now() / 1000),
        rawBody,
      }),
      [EVENT_ID_HEADER]: eventId,
    },
    body: rawBody,
  })
}

describe('StableOps webhook', () => {
  beforeEach(() => {
    process.env.STABLEOPS_WEBHOOK_SECRET = secret
    recordAndApply.mockReset().mockResolvedValue(false)
  })

  it('verifies a valid raw signature and forwards the event ID', async () => {
    const rawBody =
      '{\n  "type": "payment.finalized",\n  "data": { "payment_order_id": "po_123", "merchant_order_id": "attempt_123" }\n}'

    const response = await POST(signedRequest(rawBody))

    expect(response.status).toBe(200)
    expect(recordAndApply).toHaveBeenCalledWith('evt_123', JSON.parse(rawBody), {
      stableOpsOrderId: 'po_123',
      status: 'FINALIZED',
      fulfill: true,
    })
  })

  it('rejects an invalid signature before the event reaches the store', async () => {
    const rawBody = JSON.stringify({ type: 'payment.finalized', data: { payment_order_id: 'po_123' } })

    const response = await POST(
      new Request('https://merchant.example/api/webhooks/stableops', {
        method: 'POST',
        headers: { [EVENT_ID_HEADER]: 'evt_123', [SIGNATURE_HEADER]: 't=0,v1=bad' },
        body: rawBody,
      }),
    )

    expect(response.status).toBe(400)
    expect(recordAndApply).not.toHaveBeenCalled()
  })

  it('rejects a signed event that has no event ID', async () => {
    const rawBody = JSON.stringify({ type: 'payment.finalized', data: { payment_order_id: 'po_123' } })
    const signed = signedRequest(rawBody)
    const response = await POST(
      new Request(signed.url, {
        method: 'POST',
        headers: { [SIGNATURE_HEADER]: signed.headers.get(SIGNATURE_HEADER)! },
        body: rawBody,
      }),
    )

    expect(response.status).toBe(400)
    expect(recordAndApply).not.toHaveBeenCalled()
  })

  it('rejects a signed request whose raw body is not JSON', async () => {
    const rawBody = '{'

    const response = await POST(signedRequest(rawBody))

    expect(response.status).toBe(400)
    expect(recordAndApply).not.toHaveBeenCalled()
  })

  it('keeps a duplicate event from applying a second fulfillment', async () => {
    const seen = new Set<string>()
    let fulfillments = 0
    const store = {
      recordAndApply: vi.fn(async (eventId: string, _event: unknown, mutation: { fulfill: boolean }) => {
        if (seen.has(eventId)) return true
        seen.add(eventId)
        if (mutation.fulfill) fulfillments += 1
        return false
      }),
    }
    const input = {
      eventId: 'evt_duplicate',
      event: { type: 'payment.finalized', data: { payment_order_id: 'po_123' } },
      store,
    }

    await expect(applyWebhookEvent(input)).resolves.toEqual({ duplicate: false })
    await expect(applyWebhookEvent(input)).resolves.toEqual({ duplicate: true })

    expect(fulfillments).toBe(1)
  })

  it.each([
    ['payment.detected', 'DETECTED'],
    ['payment.confirmed', 'CONFIRMED'],
    ['payment.reverted', 'REVERTED'],
    ['payment.expired', 'EXPIRED'],
    ['payment_order.canceled', 'CANCELED'],
  ])('does not fulfill a %s event', async (type, status) => {
    const record = vi.fn().mockResolvedValue(false)

    await applyWebhookEvent({
      eventId: `evt_${type}`,
      event: { type, data: { payment_order_id: 'po_123' } },
      store: { recordAndApply: record },
    })

    expect(record).toHaveBeenCalledWith(`evt_${type}`, expect.anything(), {
      stableOpsOrderId: 'po_123',
      status,
      fulfill: false,
    })
  })
})
