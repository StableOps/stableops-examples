import { NextResponse } from 'next/server'

import { CheckoutAttemptExpiredError, createCheckoutForAttempt } from '@/lib/checkout'
import { orderStore } from '@/lib/orders'
import { createStableOpsCheckout } from '@/lib/stableops'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON。' }, { status: 400 })
  }

  const attemptId =
    typeof body === 'object' && body !== null && 'attemptId' in body ? body.attemptId : undefined
  if (typeof attemptId !== 'string' || !uuidPattern.test(attemptId)) {
    return NextResponse.json({ error: 'attemptId 必须是有效的 UUID。' }, { status: 400 })
  }

  const origin = getAppOrigin()
  if (!origin) {
    return NextResponse.json({ error: 'APP_URL 必须是有效的绝对 URL。' }, { status: 400 })
  }

  try {
    const checkout = await createCheckoutForAttempt({
      attemptId,
      origin,
      store: orderStore,
      createSession: createStableOpsCheckout,
    })
    return NextResponse.json(checkout)
  } catch (error) {
    if (error instanceof CheckoutAttemptExpiredError || isCheckoutExpiredError(error)) {
      return NextResponse.json({ error: '该 Checkout 已过期，请重试。', code: 'checkout_expired' }, { status: 409 })
    }
    throw error
  }
}

function getAppOrigin(): string | null {
  const appUrl = process.env.APP_URL
  if (!appUrl) return null

  try {
    const url = new URL(appUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

function isCheckoutExpiredError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'checkout_expired'
}
