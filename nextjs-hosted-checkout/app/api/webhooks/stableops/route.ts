import { EVENT_ID_HEADER, SIGNATURE_HEADER, verifySignature } from '@stableops/api-sdk/webhooks'

import { webhookStore } from '@/lib/orders'
import { applyWebhookEvent, type StableOpsWebhookEvent } from '@/lib/webhook'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const verification = verifySignature({
    secret: process.env.STABLEOPS_WEBHOOK_SECRET ?? '',
    header: request.headers.get(SIGNATURE_HEADER) ?? undefined,
    rawBody,
  })
  if (!verification.ok) return new Response('invalid signature', { status: 400 })

  const eventId = request.headers.get(EVENT_ID_HEADER)
  if (!eventId) return new Response('missing event id', { status: 400 })

  let event: StableOpsWebhookEvent
  try {
    event = JSON.parse(rawBody) as StableOpsWebhookEvent
  } catch {
    return new Response('invalid JSON payload', { status: 400 })
  }

  await applyWebhookEvent({ eventId, event, store: webhookStore })
  return new Response('ok')
}
