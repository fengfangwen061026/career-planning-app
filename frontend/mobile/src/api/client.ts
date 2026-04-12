const BASE = '/api'

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${path} failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
}

export async function uploadFile(path: string, file: File): Promise<Response> {
  const formData = new FormData()
  formData.append('file', file)
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  })
}

export async function* readSSE(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok || !res.body) {
    throw new Error(`SSE ${path} failed: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue
      }
      const raw = line.slice(6).trim()
      if (!raw) {
        continue
      }
      try {
        yield JSON.parse(raw) as Record<string, unknown>
      } catch {
        // ignore malformed event chunk
      }
    }
  }
}
