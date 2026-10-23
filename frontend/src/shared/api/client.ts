export type ApiErrorBody = { error?: { code?: string; message?: string; fields?: string[] }; message?: string }

export class ApiRequestError extends Error {
  readonly code: string
  readonly fields: string[]
  readonly status: number
  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message ?? body.message ?? 'The request could not be completed.')
    this.name = 'ApiRequestError'
    this.code = body.error?.code ?? 'REQUEST_FAILED'
    this.status = status
    this.fields = body.error?.fields ?? []
  }
}

function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}

async function apiFetch(path: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  if (init?.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    return await fetch(`${apiBase()}${path}`, { credentials: 'include', ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The request timed out. Check that the Flowline API is running.', { cause: error })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody
  if (!response.ok) throw new ApiRequestError(response.status, body)
  return body as T
}

export async function requestJson<T>(path: string, init?: RequestInit) {
  return parse<T>(
    await apiFetch(path, {
      ...init,
      ...(init?.body !== undefined || init?.headers
        ? { headers: { ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init?.headers } }
        : {}),
    }),
  )
}

export async function requestFormData<T>(path: string, data: FormData, init?: RequestInit) {
  return parse<T>(await apiFetch(path, { ...init, method: 'POST', body: data }))
}
