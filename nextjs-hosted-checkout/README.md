# Next.js Hosted USDC Checkout

[English](#english) | [中文](#中文)

---

<a id="english"></a>
## English

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FStableOps%2Fstableops-examples&root-directory=nextjs-hosted-checkout&env=DATABASE_URL,DIRECT_URL,STABLEOPS_API_KEY,STABLEOPS_WEBHOOK_SECRET,APP_URL&envDescription=Add%20your%20Supabase%20connection%20URLs%20and%20server-only%20StableOps%20credentials.)

**Demo:** <https://nextjs-hosted-checkout.vercel.app/>

A deployable Next.js App Router example: click a button to enter a StableOps-hosted payment page and complete a test payment of **12.00 USDC on Base Sepolia**. The browser never sees `STABLEOPS_API_KEY`; the server creates a Checkout Session and order status is updated only via signed webhooks.

The Deploy Button specifies only the repository, example directory, and environment variable names — **it does not pass any passwords, API keys, or webhook secrets**. Store these values only in a local `.env`, Vercel Environment Variables, or another secrets manager.

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase **Transaction Pooler** PostgreSQL URL used at runtime. |
| `DIRECT_URL` | Supabase **Direct Connection** PostgreSQL URL, used only by Prisma migrations. |
| `STABLEOPS_API_KEY` | Server-side StableOps sandbox API key for creating hosted Checkouts. |
| `STABLEOPS_WEBHOOK_SECRET` | Signing secret generated when the StableOps webhook endpoint was created. |
| `APP_URL` | Public HTTPS root after deployment, e.g. `https://your-app.vercel.app`. Used to build success/cancel return URLs. |
| `WALLETCONNECT_PROJECT_ID` | (Optional) WalletConnect Cloud project ID. Enables mobile wallet connections on the hosted checkout page. Get one at [cloud.walletconnect.com](https://cloud.walletconnect.com/). |

Do **not** prefix any of these variables with `NEXT_PUBLIC_`.

### Deploy to Vercel

1. Create a free PostgreSQL project on [Supabase](https://supabase.com/). In the project **Connect** settings, copy the **Transaction Pooler** URL into `DATABASE_URL` and the **Direct Connection** URL into `DIRECT_URL`. Both must use SSL; do not use the Pooler URL as `DIRECT_URL`.
2. Create a StableOps sandbox API key and fill in `STABLEOPS_API_KEY`. You can leave `STABLEOPS_WEBHOOK_SECRET` and `APP_URL` as placeholders until you obtain the real Vercel domain.
3. Click **Deploy with Vercel** above and enter the database URLs and API key in the environment variable form. The `vercel.json` runs `pnpm db:migrate` (`prisma migrate deploy`) before building on **Production** only; **Preview** deploys build without migrating a shared database. Preview must not reuse Production database, API key, or webhook secret — configure isolated variables or a separate preview database.
4. After deployment, copy the production domain from Vercel and set `APP_URL` to the root URL (e.g. `https://your-app.vercel.app`, no trailing path).
5. Create a StableOps webhook endpoint at `https://YOUR-VERCEL-DOMAIN/api/webhooks/stableops`. Subscribe to at least `payment.detected`, `payment.confirmed`, `payment.finalized`, `payment.reverted`, and `payment.expired`. Subscribe to `payment_order.canceled` if available.
6. Paste the new endpoint's signing secret into `STABLEOPS_WEBHOOK_SECRET`, then redeploy Production. Open the site, click **Pay with USDC**, and complete the 12.00 USDC test payment on the hosted page.

> Supabase free projects may pause after inactivity; the first request and webhook after resume may be slow. Verify the database is active before demoing.

### Local Development

Requires Node.js 20.9+, pnpm 10+, a Supabase PostgreSQL database, and StableOps sandbox credentials.

```bash
pnpm install
cp .env.example .env
# Edit .env: fill DATABASE_URL, DIRECT_URL, STABLEOPS_API_KEY,
# STABLEOPS_WEBHOOK_SECRET, and APP_URL=http://localhost:3000
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. To receive webhooks locally, expose your local server over an HTTPS tunnel and point the StableOps endpoint to `https://YOUR-TUNNEL-DOMAIN/api/webhooks/stableops`; also update `APP_URL` to the public root URL.

### Verify

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

### Security & Production Notes

- Success/cancel return pages are **not** payment proof. They display the current order status; only the `payment.finalized` webhook marks an order as fulfilled.
- The webhook handler reads the raw request body first, then verifies the signature with `STABLEOPS_WEBHOOK_SECRET`. Do not parse or rewrite JSON before verification. Each event ID is unique-constrained in the database, guaranteeing idempotent retry handling without duplicate fulfillment.
- This example writes fulfillment status directly to the order table for simplicity. Production should add user authentication, rate limiting on checkout and webhook endpoints, audit logging, and an outbox (or equivalent atomic side-effect workflow) to reliably trigger shipping, email, or other external actions.

---

<a id="中文"></a>
## 中文

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FStableOps%2Fstableops-examples&root-directory=nextjs-hosted-checkout&env=DATABASE_URL,DIRECT_URL,STABLEOPS_API_KEY,STABLEOPS_WEBHOOK_SECRET,APP_URL&envDescription=Add%20your%20Supabase%20connection%20URLs%20and%20server-only%20StableOps%20credentials.)

**在线演示：** <https://nextjs-hosted-checkout.vercel.app/>

这是一个可直接部署的 Next.js App Router 示例：用户点击按钮后会进入 StableOps 托管支付页面，使用 **Base Sepolia 上的 12.00 USDC** 完成测试支付。浏览器不会接触 `STABLEOPS_API_KEY`；服务端创建 Checkout Session，并且只以已验签的 webhook 更新订单状态。

Deploy Button 只指定仓库、示例目录和环境变量名称，**不会传递任何密码、API key 或 webhook secret**。请只在本地 `.env`、Vercel Environment Variables 或其他秘密管理服务中保存这些值。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Supabase **Transaction Pooler** PostgreSQL URL，应用运行时使用。 |
| `DIRECT_URL` | Supabase **Direct Connection** PostgreSQL URL，仅供 Prisma migration 使用。 |
| `STABLEOPS_API_KEY` | 服务端 StableOps sandbox API key，用于创建托管 Checkout。 |
| `STABLEOPS_WEBHOOK_SECRET` | StableOps webhook endpoint 创建后生成的签名密钥。 |
| `APP_URL` | 部署后的公开 HTTPS 根域名，例如 `https://your-app.vercel.app`。用于生成成功和取消回跳 URL。 |
| `WALLETCONNECT_PROJECT_ID` | （可选）WalletConnect Cloud project ID。启用托管 Checkout 页面上的手机钱包连接。在 [cloud.walletconnect.com](https://cloud.walletconnect.com/) 获取。 |

不要给任何上述变量加 `NEXT_PUBLIC_` 前缀。

### 一键部署到 Vercel

1. 在 [Supabase](https://supabase.com/) 创建一个免费 PostgreSQL 项目。打开项目的 **Connect** 设置：复制 **Transaction Pooler** URL 到 `DATABASE_URL`，复制 **Direct Connection** URL 到 `DIRECT_URL`。两者都应使用 SSL；不要将 Pooler URL 用作 `DIRECT_URL`。
2. 在 StableOps 创建 sandbox API key，填入 `STABLEOPS_API_KEY`。首次部署前可先将 `STABLEOPS_WEBHOOK_SECRET` 和 `APP_URL` 留为占位值；它们会在取得 Vercel 真实域名后更新。
3. 点击上方 **Deploy with Vercel**，在 Vercel 的环境变量表单中填写数据库 URL 和 API key，然后部署。`vercel.json` 会在 **Production** 部署时先执行 `pnpm db:migrate`（即 `prisma migrate deploy`）再构建；**Preview** 部署只构建，绝不会迁移共享数据库。Preview 不得复用 Production 的数据库、API key 或 webhook secret；请为 Preview 配置隔离的环境变量或独立的预览数据库。
4. 部署完成后，从 Vercel 复制真实生产域名，并将 `APP_URL` 设置为该域名的根 URL（例如 `https://your-app.vercel.app`，不带路径）。
5. 在 StableOps 创建 webhook endpoint：`https://YOUR-VERCEL-DOMAIN/api/webhooks/stableops`。至少订阅 `payment.detected`、`payment.confirmed`、`payment.finalized`、`payment.reverted` 和 `payment.expired`。（如控制台提供 `payment_order.canceled`，也建议订阅。）
6. 将新 endpoint 生成的 signing secret 填入 `STABLEOPS_WEBHOOK_SECRET`，然后重新部署 Production。现在可打开站点，点击"使用 USDC 支付"，并在托管支付页面用 Base Sepolia USDC 完成 12.00 USDC 测试支付。

> Supabase 免费项目在闲置后可能暂停；恢复后首个请求和 webhook 可能变慢。演示或测试前请确认数据库项目处于运行状态。

### 本地运行

需要 Node.js 20.9+、pnpm 10+、一个 Supabase PostgreSQL 数据库以及 StableOps sandbox 凭据。

```bash
pnpm install
cp .env.example .env
# 编辑 .env：填入 DATABASE_URL、DIRECT_URL、STABLEOPS_API_KEY、
# STABLEOPS_WEBHOOK_SECRET 和 APP_URL=http://localhost:3000
pnpm db:migrate
pnpm dev
```

打开 <http://localhost:3000>。要在本地接收公网 webhook，请把本地服务通过安全隧道暴露为 HTTPS，并在 StableOps 中将 endpoint 配置为 `https://YOUR-TUNNEL-DOMAIN/api/webhooks/stableops`；同时将 `APP_URL` 改为该公开根 URL。

### 验证

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

### 安全与生产注意事项

- 成功或取消回跳不是付款凭据。页面只显示当前订单状态；只有 `payment.finalized` webhook 才会标记订单已完成。
- webhook handler 先读取原始请求体，再用 `STABLEOPS_WEBHOOK_SECRET` 验证签名；不要在验签前解析或改写 JSON。每个 event ID 都由数据库唯一约束记录，保证 webhook 重试处理具备幂等性，不会重复履约。
- 此示例将履约状态写入订单表，便于理解流程。生产环境还应添加用户认证、checkout 与 webhook 接口的速率限制、审计记录，以及 outbox（或等价的原子副作用工作流），以可靠地触发发货、邮件或其他外部操作。
