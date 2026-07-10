import { CheckoutButton } from '@/components/checkout-button'

export default function HomePage() {
  return (
    <main>
      <h1>Next.js USDC Checkout</h1>
      <p>通过 StableOps 托管 Checkout 使用 Base Sepolia USDC 完成测试支付。</p>
      <p>金额：0.01 USDC</p>
      <CheckoutButton />
    </main>
  )
}
