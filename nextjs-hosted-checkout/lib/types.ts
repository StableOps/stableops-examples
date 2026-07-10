export type PaymentStatus =
  | 'CREATED'
  | 'DETECTED'
  | 'CONFIRMED'
  | 'FINALIZED'
  | 'REVERTED'
  | 'EXPIRED'
  | 'CANCELED'

export interface StoredOrder {
  id: string
  stableOpsOrderId?: string | null
  checkoutUrl: string | null
  checkoutExpiresAt: Date
  paymentStatus?: PaymentStatus
}

export interface Store {
  find(id: string): Promise<StoredOrder | null>
  create(id: string, checkoutExpiresAt: Date): Promise<StoredOrder>
  saveCheckout(id: string, stableOpsOrderId: string, checkoutUrl: string): Promise<StoredOrder>
}
