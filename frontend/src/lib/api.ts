import type { AuthResponse, UserInfo } from './types'

const REFRESH_KEY = 'noxen.refreshToken'

// O access token vive só em memória. O refresh token fica no localStorage (ver ADR-0004: risco de XSS
// aceito nesta fase; revisar antes de produção, por exemplo migrando para cookie httpOnly).
let accessToken: string | null = null
let onAuthLost: (() => void) | null = null

export function setAuthLostHandler(handler: (() => void) | null) {
  onAuthLost = handler
}

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

function storeSession(auth: AuthResponse) {
  accessToken = auth.accessToken
  try {
    localStorage.setItem(REFRESH_KEY, auth.refreshToken)
  } catch {
    /* navegador sem storage: a sessão dura até recarregar a página */
  }
}

export function clearSession() {
  accessToken = null
  try {
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    /* ignorar */
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let title = `Erro ${res.status}`
  let fieldErrors: Record<string, string[]> | undefined
  try {
    const problem = (await res.json()) as { title?: string; errors?: Record<string, string[]> }
    if (problem.errors) {
      fieldErrors = problem.errors
      title = Object.values(problem.errors).flat().join(' ')
    } else if (problem.title) {
      title = problem.title
    }
  } catch {
    /* corpo vazio ou não-JSON */
  }
  if (res.status === 429) title = 'Muitas tentativas. Aguarde um minuto e tente de novo.'
  return new ApiError(res.status, title, fieldErrors)
}

// Um único refresh por vez: o refresh token é rotativo, então duas chamadas simultâneas com o mesmo token
// seriam tratadas pela API como reuso (roubo) e encerrariam a sessão.
let refreshing: Promise<UserInfo | null> | null = null

/** Troca o refresh token guardado por uma sessão nova. Devolve o usuário ou null se não houver sessão válida. */
export function restoreSession(): Promise<UserInfo | null> {
  refreshing ??= (async () => {
    const token = readRefreshToken()
    if (!token) return null
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      })
      if (!res.ok) {
        if (res.status === 401) clearSession()
        return null
      }
      const auth = (await res.json()) as AuthResponse
      storeSession(auth)
      return auth.user
    } catch {
      return null // API indisponível: mantém o token para tentar de novo depois
    }
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

interface RequestOptions {
  /** Desliga a renovação automática do token (login). */
  retry?: boolean
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })

  if (res.status === 401 && options.retry !== false && readRefreshToken()) {
    const user = await restoreSession()
    if (user) return request<T>(method, path, body, { retry: false })
    onAuthLost?.()
  }
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
}

export async function login(email: string, password: string): Promise<UserInfo> {
  const auth = await request<AuthResponse>('POST', '/api/auth/login', { email, password }, { retry: false })
  storeSession(auth)
  return auth.user
}

export async function logout(): Promise<void> {
  const token = readRefreshToken()
  clearSession()
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      })
    } catch {
      /* sem rede: o token expira sozinho */
    }
  }
}

/** Monta a query string ignorando valores vazios. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') sp.set(key, String(value))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
