type CheckoutResponse = {
  status: number
  payload: unknown
}

export async function requestCheckoutForAttempt({
  attemptId,
  request,
  createAttemptId,
}: {
  attemptId: string
  request(attemptId: string): Promise<CheckoutResponse>
  createAttemptId(): string
}): Promise<{ attemptId: string; url: string }> {
  let currentAttemptId = attemptId

  for (let retry = 0; retry < 2; retry += 1) {
    const { status, payload } = await request(currentAttemptId)
    if (isExpiredAttempt(status, payload) && retry === 0) {
      currentAttemptId = createAttemptId()
      continue
    }
    if (status < 200 || status >= 300 || !hasUrl(payload)) {
      throw new Error(getCheckoutErrorMessage(payload))
    }

    return { attemptId: currentAttemptId, url: payload.url }
  }

  throw new Error('无法创建 Checkout，请稍后重试。')
}

function isExpiredAttempt(status: number, payload: unknown): boolean {
  return status === 409 && isObject(payload) && payload.code === 'checkout_expired'
}

function hasUrl(payload: unknown): payload is { url: string } {
  return isObject(payload) && typeof payload.url === 'string'
}

function getCheckoutErrorMessage(payload: unknown): string {
  return isObject(payload) && typeof payload.error === 'string' ? payload.error : '无法创建 Checkout，请稍后重试。'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
