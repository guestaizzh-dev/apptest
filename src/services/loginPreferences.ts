import type { LoginIdentity, LoginType } from '@/types/auth'

const REMEMBERED_LOGIN_KEY = 'gui-er-xue-zhi.remembered-login'

export function readRememberedLogin(): { phone: string; loginType: LoginType } | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const stored = localStorage.getItem(REMEMBERED_LOGIN_KEY)
    if (!stored) return null
    const identity: unknown = JSON.parse(stored)
    if (
      typeof identity === 'object' &&
      identity !== null &&
      'phone' in identity &&
      typeof identity.phone === 'string' &&
      /^1\d{10}$/.test(identity.phone)
    ) {
      const loginType = 'loginType' in identity ? identity.loginType : 'CODE'
      if (loginType === 'CODE' || loginType === 'PASSWORD') {
        // 兼容旧表单记录；迁移时移除已失效的验证码，只保存账号和登录方式。
        localStorage.setItem(
          REMEMBERED_LOGIN_KEY,
          JSON.stringify({ phone: identity.phone, loginType }),
        )
        return { phone: identity.phone, loginType }
      }
    }
    clearRememberedLogin()
  } catch {
    clearRememberedLogin()
  }
  return null
}

export function saveRememberedLogin(identity: LoginIdentity): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(
      REMEMBERED_LOGIN_KEY,
      JSON.stringify({ phone: identity.phone, loginType: identity.loginType }),
    )
    return true
  } catch {
    return false
  }
}

export function clearRememberedLogin(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.removeItem(REMEMBERED_LOGIN_KEY)
    return true
  } catch {
    return false
  }
}
