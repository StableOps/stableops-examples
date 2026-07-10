import type { PaymentStatus } from '@/lib/types'

export type StableOpsWebhookEvent = {
  type: string
  data: {
    payment_order_id?: string
    merchant_order_id?: string
  }
}

export type WebhookMutation = {
  stableOpsOrderId?: string
  status?: Exclude<PaymentStatus, 'CREATED'>
  fulfill: boolean
}

export type WebhookStore = {
  recordAndApply(eventId: string, event: StableOpsWebhookEvent, mutation: WebhookMutation): Promise<boolean>
}

const statuses = {
  'payment.detected': 'DETECTED',
  'payment.confirmed': 'CONFIRMED',
  'payment.finalized': 'FINALIZED',
  'payment.reverted': 'REVERTED',
  'payment.expired': 'EXPIRED',
  'payment_order.canceled': 'CANCELED',
} as const satisfies Record<string, Exclude<PaymentStatus, 'CREATED'>>

const allowedTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ['DETECTED', 'EXPIRED', 'CANCELED', 'FINALIZED'],
  DETECTED: ['CONFIRMED', 'REVERTED', 'FINALIZED'],
  CONFIRMED: ['FINALIZED', 'REVERTED'],
  FINALIZED: [],
  REVERTED: ['CONFIRMED'],
  EXPIRED: [],
  CANCELED: [],
}

export function getWebhookMutation(event: StableOpsWebhookEvent): WebhookMutation {
  return {
    stableOpsOrderId: event.data.payment_order_id,
    status: statuses[event.type as keyof typeof statuses],
    fulfill: event.type === 'payment.finalized',
  }
}

export function nextPaymentStatus(current: PaymentStatus, target: WebhookMutation['status']): PaymentStatus {
  if (!target || current === target) return current
  return allowedTransitions[current].includes(target) ? target : current
}

export async function applyWebhookEvent({
  eventId,
  event,
  store,
}: {
  eventId: string
  event: StableOpsWebhookEvent
  store: WebhookStore
}): Promise<{ duplicate: boolean }> {
  const duplicate = await store.recordAndApply(eventId, event, getWebhookMutation(event))

  return { duplicate }
}
