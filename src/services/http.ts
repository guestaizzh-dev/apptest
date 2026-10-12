import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { createMockAdapter } from '@/mocks/teachingAdapter'
import { sessionErrorMessage, sessionToken, setSessionToken } from './session'

/**
 * 全部业务请求通过这一实例。
 * mock 模式显式启用：真实请求失败时不会静默回退到演示数据。
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  adapter: import.meta.env.VITE_USE_MOCK_API === 'true' ? createMockAdapter() : undefined,
})

/** 登录、会话与实时课堂接口始终使用真实网络，不受教学演示数据开关影响。 */
export const backendHttp = axios.create({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL || import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'RequestError'
  }
}

function expireSession(sentToken: unknown, message: string): void {
  // 并发的旧请求不能清掉刚刚建立的新会话。
  if (sentToken && sentToken === sessionToken.value) {
    sessionErrorMessage.value = message
    setSessionToken('')
  }
}

for (const client of [http, backendHttp]) {
  client.interceptors.request.use((config) => {
    if (
      !['/auth/teacher-login', '/auth/sms-code'].includes(config.url || '') &&
      sessionToken.value &&
      !config.headers.has('satoken')
    ) {
      config.headers.set('satoken', sessionToken.value)
    }
    return config
  })

  /** 后端业务失败可能使用 HTTP 200，必须同时检查 AjaxResult.code。 */
  client.interceptors.response.use(
    (response) => {
      const body = response.data as { code?: unknown; msg?: unknown } | undefined
      if (typeof body?.code === 'number' && body.code !== 200) {
        const message = typeof body.msg === 'string' ? body.msg : '请求失败，请稍后重试。'
        if ([401, 40101, 40102].includes(body.code))
          expireSession(response.config.headers.get('satoken'), message)
        throw new RequestError(message, body.code)
      }
      return response
    },
    (error: unknown) => {
      if (axios.isCancel(error)) return Promise.reject(error)

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown; msg?: unknown } | undefined
        const serverMessage =
          typeof body?.msg === 'string'
            ? body.msg
            : typeof body?.message === 'string'
              ? body.message
              : undefined
        const message =
          serverMessage ||
          (error.code === 'ECONNABORTED'
            ? '请求超时，请稍后重试。'
            : '请求失败，请检查网络后重试。')
        if (error.response?.status === 401)
          expireSession(error.config?.headers.get('satoken'), message)
        return Promise.reject(new RequestError(message, error.response?.status, { cause: error }))
      }

      return Promise.reject(error)
    },
  )
}

/** 将 AxiosResponse 的包装限制在请求层；页面和 store 只接收有类型的业务数据。 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}
