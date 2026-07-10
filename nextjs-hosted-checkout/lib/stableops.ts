import 'server-only'

import { StableOps, type CreateCheckoutSessionInput } from '@stableops/api-sdk'

let stableOps: StableOps | undefined

function getStableOps(): StableOps {
  const apiKey = process.env.STABLEOPS_API_KEY
  if (!apiKey) {
    throw new Error('缺少 STABLEOPS_API_KEY，无法创建 StableOps Checkout。')
  }

  stableOps ??= new StableOps({ apiKey })
  return stableOps
}

export type StableOpsCheckoutInput = CreateCheckoutSessionInput & {
  idempotencyKey: string
}

export async function createStableOpsCheckout({
  idempotencyKey,
  ...input
}: StableOpsCheckoutInput): Promise<{ paymentOrderId: string; url: string }> {
  const session = await getStableOps().checkoutSessions.create(input, { idempotencyKey })
  if (!session.url) {
    throw new Error('StableOps Checkout 未返回可跳转的 URL。')
  }

  return { paymentOrderId: session.paymentOrder.id, url: session.url }
}
