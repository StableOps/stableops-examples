'use client'

import { useRef, useState } from 'react'

import { requestCheckoutForAttempt } from '@/lib/checkout-client'

export function CheckoutButton() {
  const attemptId = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function startCheckout() {
    attemptId.current ??= crypto.randomUUID()
    setError(null)
    setIsLoading(true)

    try {
      const checkout = await requestCheckoutForAttempt({
        attemptId: attemptId.current,
        createAttemptId: () => crypto.randomUUID(),
        request: async (currentAttemptId) => {
          const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ attemptId: currentAttemptId }),
          })
          return { status: response.status, payload: await response.json() }
        },
      })
      attemptId.current = checkout.attemptId

      window.location.assign(checkout.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法创建 Checkout，请稍后重试。')
      setIsLoading(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={startCheckout} disabled={isLoading}>
        {isLoading ? '正在创建 Checkout…' : '使用 USDC 支付'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
