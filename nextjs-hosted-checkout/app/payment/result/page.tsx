import { getPaymentResultMessage } from '@/lib/payment-result'
import { orderStore } from '@/lib/orders'

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; result?: string }>
}) {
  const { order: orderId, result } = await searchParams
  const order = orderId ? await orderStore.find(orderId) : null

  return (
    <main>
      <h1>支付结果</h1>
      <p>{getPaymentResultMessage(order?.paymentStatus, result)}</p>
      {order ? <p>订单号：{order.id}</p> : null}
    </main>
  )
}
