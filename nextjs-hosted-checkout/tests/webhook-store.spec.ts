import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  findPending: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  updateEvent: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { orderStore, webhookStore } from '@/lib/orders'

const event = { type: 'payment.finalized', data: { payment_order_id: 'po_123' } }

function mockTransaction() {
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      webhookEvent: { createMany: mocks.createMany, findMany: mocks.findPending, update: mocks.updateEvent },
      order: { findUnique: mocks.findUnique, update: mocks.update, updateMany: mocks.updateMany },
    }),
  )
}

describe('webhookStore.recordAndApply', () => {
  beforeEach(() => {
    mocks.createMany.mockReset()
    mocks.findPending.mockReset()
    mocks.findUnique.mockReset()
    mocks.update.mockReset()
    mocks.updateMany.mockReset()
    mocks.updateEvent.mockReset()
    mocks.transaction.mockReset()
  })

  it('records a finalized payload and fulfills its matching order once in the transaction', async () => {
    mockTransaction()
    mocks.createMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue({ id: 'order_123', paymentStatus: 'CREATED' })
    mocks.update.mockResolvedValue({})
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.updateEvent.mockResolvedValue({})

    await expect(
      webhookStore.recordAndApply('evt_123', event, {
        stableOpsOrderId: 'po_123',
        status: 'FINALIZED',
        fulfill: true,
      }),
    ).resolves.toBe(false)

    expect(mocks.createMany).toHaveBeenCalledWith({
      data: {
        eventId: 'evt_123',
        type: 'payment.finalized',
        stableOpsOrderId: 'po_123',
        payload: event,
      },
      skipDuplicates: true,
    })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'order_123', fulfilledAt: null },
      data: { fulfilledAt: expect.any(Date) },
    })
  })

  it('treats a skipped event insert as a duplicate without mutating the order', async () => {
    mockTransaction()
    mocks.createMany.mockResolvedValue({ count: 0 })

    await expect(
      webhookStore.recordAndApply('evt_duplicate', event, {
        stableOpsOrderId: 'po_123',
        status: 'FINALIZED',
        fulfill: true,
      }),
    ).resolves.toBe(true)

    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('records an event for an unknown order without throwing', async () => {
    mockTransaction()
    mocks.createMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue(null)

    await expect(
      webhookStore.recordAndApply('evt_unknown', event, {
        stableOpsOrderId: 'po_unknown',
        status: 'FINALIZED',
        fulfill: true,
      }),
    ).resolves.toBe(false)

    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
    expect(mocks.updateEvent).not.toHaveBeenCalled()
  })

  it('uses data.merchant_order_id to fulfill an existing attempt before saveCheckout writes stableOpsOrderId', async () => {
    mockTransaction()
    mocks.createMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue({ id: 'attempt_123', paymentStatus: 'CREATED' })
    mocks.update.mockResolvedValue({ id: 'attempt_123', paymentStatus: 'FINALIZED' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.updateEvent.mockResolvedValue({})
    const eventBeforeCheckoutSave = {
      type: 'payment.finalized',
      data: { payment_order_id: 'po_123', merchant_order_id: 'attempt_123' },
    }

    await webhookStore.recordAndApply('evt_by_merchant_order', eventBeforeCheckoutSave, {
      stableOpsOrderId: 'po_123',
      status: 'FINALIZED',
      fulfill: true,
    })

    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 'attempt_123' }, select: expect.anything() })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'attempt_123', fulfilledAt: null },
      data: { fulfilledAt: expect.any(Date) },
    })
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      where: { eventId: 'evt_by_merchant_order' },
      data: { orderId: 'attempt_123' },
    })

    mocks.findPending.mockResolvedValue([])
    mocks.update.mockResolvedValue({
      id: 'attempt_123',
      stableOpsOrderId: 'po_123',
      checkoutUrl: 'https://pay.example/cs_123',
      checkoutExpiresAt: new Date('2026-07-10T00:30:00.000Z'),
      paymentStatus: 'FINALIZED',
    })
    await orderStore.saveCheckout('attempt_123', 'po_123', 'https://pay.example/cs_123')

    expect(mocks.updateMany).toHaveBeenCalledTimes(1)
  })

  it('reconciles a finalized event accepted before saveCheckout associates its StableOps order', async () => {
    const pendingEvents: Array<{
      eventId: string
      type: string
      stableOpsOrderId: string | null
      orderId: string | null
    }> = []
    let order = {
      id: 'attempt_123',
      stableOpsOrderId: null as string | null,
      checkoutUrl: null as string | null,
      checkoutExpiresAt: new Date('2026-07-10T00:30:00.000Z'),
      paymentStatus: 'CREATED' as const,
    }
    mockTransaction()
    mocks.createMany.mockImplementation(async ({ data }) => {
      pendingEvents.push({ ...data, orderId: null })
      return { count: 1 }
    })
    mocks.findUnique.mockResolvedValue(null)
    mocks.findPending.mockImplementation(async ({ where }) =>
      pendingEvents.filter((event) => event.stableOpsOrderId === where.stableOpsOrderId && event.orderId === null),
    )
    mocks.update.mockImplementation(async ({ data }) => {
      order = { ...order, ...data }
      return order
    })
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.updateEvent.mockImplementation(async ({ where, data }) => {
      const pending = pendingEvents.find((event) => event.eventId === where.eventId)
      if (pending) pending.orderId = data.orderId
      return pending
    })

    await webhookStore.recordAndApply('evt_before_checkout', event, {
      stableOpsOrderId: 'po_123',
      status: 'FINALIZED',
      fulfill: true,
    })
    const saved = await orderStore.saveCheckout('attempt_123', 'po_123', 'https://pay.example/cs_123')

    expect(saved.paymentStatus).toBe('FINALIZED')
    expect(mocks.findPending).toHaveBeenCalledWith({
      where: { stableOpsOrderId: 'po_123', orderId: null },
      orderBy: { receivedAt: 'asc' },
    })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'attempt_123', fulfilledAt: null },
      data: { fulfilledAt: expect.any(Date) },
    })
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      where: { eventId: 'evt_before_checkout' },
      data: { orderId: 'attempt_123' },
    })
  })

  it.each(['payment.confirmed', 'payment.detected'])('does not downgrade FINALIZED when %s arrives late', async (type) => {
    mockTransaction()
    mocks.createMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue({ id: 'order_123', paymentStatus: 'FINALIZED' })
    mocks.updateEvent.mockResolvedValue({})

    await webhookStore.recordAndApply(
      `evt_late_${type}`,
      { type, data: { payment_order_id: 'po_123' } },
      {
        stableOpsOrderId: 'po_123',
        status: type === 'payment.confirmed' ? 'CONFIRMED' : 'DETECTED',
        fulfill: false,
      },
    )

    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('retries a P2034 serialization conflict with a SERIALIZABLE transaction', async () => {
    const tx = {
      webhookEvent: { createMany: mocks.createMany, findMany: mocks.findPending, update: mocks.updateEvent },
      order: { findUnique: mocks.findUnique, update: mocks.update, updateMany: mocks.updateMany },
    }
    mocks.transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback(tx))
    mocks.createMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue({ id: 'order_123', paymentStatus: 'CREATED' })
    mocks.update.mockResolvedValue({ id: 'order_123', paymentStatus: 'DETECTED' })
    mocks.updateEvent.mockResolvedValue({})

    await expect(
      webhookStore.recordAndApply(
        'evt_serializable_retry',
        { type: 'payment.detected', data: { payment_order_id: 'po_123' } },
        { stableOpsOrderId: 'po_123', status: 'DETECTED', fulfill: false },
      ),
    ).resolves.toBe(false)

    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
  })
})
