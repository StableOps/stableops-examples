import type { PaymentStatus } from '@/lib/types'

export function getPaymentResultMessage(
  paymentStatus: PaymentStatus | null | undefined,
  redirectResult: string | undefined,
): string {
  // 重定向参数仅用于界面上下文，不能作为履约依据。
  void redirectResult
  if (paymentStatus === 'FINALIZED') return '支付已确认，订单已完成。'
  if (!paymentStatus) return '未找到订单。'
  return `当前支付状态：${paymentStatus}。正在等待已验签 webhook 确认，尚未履约。`
}
