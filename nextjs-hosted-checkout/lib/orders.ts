import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { PaymentStatus, Store, StoredOrder } from '@/lib/types'
import {
  getWebhookMutation,
  nextPaymentStatus,
  type StableOpsWebhookEvent,
  type WebhookMutation,
  type WebhookStore,
} from '@/lib/webhook'

const orderSelect = {
  id: true,
  stableOpsOrderId: true,
  checkoutUrl: true,
  checkoutExpiresAt: true,
  paymentStatus: true,
} as const

function toStoredOrder(order: {
  id: string
  stableOpsOrderId: string | null
  checkoutUrl: string | null
  checkoutExpiresAt: Date
  paymentStatus: StoredOrder['paymentStatus']
}): StoredOrder {
  return order
}

type PersistedOrder = {
  id: string
  stableOpsOrderId: string | null
  checkoutUrl: string | null
  checkoutExpiresAt: Date
  paymentStatus: PaymentStatus
}

const SERIALIZATION_RETRIES = 3

async function runSerializableTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < SERIALIZATION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === SERIALIZATION_RETRIES - 1) throw error
    }
  }

  throw new Error('unreachable')
}

function isSerializationFailure(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034'
}

async function applyMutationToOrder(
  tx: Prisma.TransactionClient,
  order: PersistedOrder,
  mutation: WebhookMutation,
): Promise<PersistedOrder> {
  const paymentStatus = nextPaymentStatus(order.paymentStatus, mutation.status)
  const updatedOrder =
    paymentStatus === order.paymentStatus
      ? order
      : await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus },
          select: orderSelect,
        })

  if (mutation.fulfill && paymentStatus === 'FINALIZED') {
    await tx.order.updateMany({
      where: { id: order.id, fulfilledAt: null },
      data: { fulfilledAt: new Date() },
    })
  }

  return updatedOrder
}

export const orderStore: Store = {
  async find(id) {
    const order = await prisma.order.findUnique({ where: { id }, select: orderSelect })
    return order ? toStoredOrder(order) : null
  },

  async create(id, checkoutExpiresAt) {
    const order = await prisma.order.create({
      data: { id, checkoutExpiresAt },
      select: orderSelect,
    })
    return toStoredOrder(order)
  },

  async saveCheckout(id, stableOpsOrderId, checkoutUrl) {
    return runSerializableTransaction(async (tx) => {
      let order = await tx.order.update({
        where: { id },
        data: { stableOpsOrderId, checkoutUrl },
        select: orderSelect,
      })
      const pendingEvents = await tx.webhookEvent.findMany({
        where: { stableOpsOrderId, orderId: null },
        orderBy: { receivedAt: 'asc' },
      })

      for (const event of pendingEvents) {
        order = await applyMutationToOrder(
          tx,
          order,
          getWebhookMutation({
            type: event.type,
            data: { payment_order_id: event.stableOpsOrderId ?? undefined },
          }),
        )
        await tx.webhookEvent.update({ where: { eventId: event.eventId }, data: { orderId: order.id } })
      }

      return toStoredOrder(order)
    })
  },
}

export const webhookStore: WebhookStore = {
  async recordAndApply(eventId: string, event: StableOpsWebhookEvent, mutation: WebhookMutation) {
    return runSerializableTransaction(async (tx) => {
      const recorded = await tx.webhookEvent.createMany({
        data: {
          eventId,
          type: event.type,
          stableOpsOrderId: event.data.payment_order_id,
          payload: event as Prisma.InputJsonValue,
        },
        skipDuplicates: true,
      })
      if (recorded.count === 0) return true

      if (!mutation.stableOpsOrderId || !mutation.status) return false

      const order = await findOrderForEvent(tx, event, mutation.stableOpsOrderId)
      if (!order) return false

      await applyMutationToOrder(tx, order, mutation)
      await tx.webhookEvent.update({ where: { eventId }, data: { orderId: order.id } })
      return false
    })
  },
}

function findOrderForEvent(
  tx: Prisma.TransactionClient,
  event: StableOpsWebhookEvent,
  stableOpsOrderId: string | undefined,
): Promise<PersistedOrder | null> {
  if (event.data.merchant_order_id) {
    return tx.order.findUnique({ where: { id: event.data.merchant_order_id }, select: orderSelect })
  }
  if (!stableOpsOrderId) return Promise.resolve(null)
  return tx.order.findUnique({ where: { stableOpsOrderId }, select: orderSelect })
}
