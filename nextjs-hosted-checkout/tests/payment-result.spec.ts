import { describe, expect, it } from 'vitest'

import { getPaymentResultMessage } from '@/lib/payment-result'

describe('getPaymentResultMessage', () => {
  it('keeps a success redirect pending until a signed webhook finalizes the order', () => {
    expect(getPaymentResultMessage('CREATED', 'success')).toMatch(/等待.*webhook/u)
  })

  it('shows fulfillment only for finalized orders', () => {
    expect(getPaymentResultMessage('FINALIZED', 'success')).toBe('支付已确认，订单已完成。')
  })
})
