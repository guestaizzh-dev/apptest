import { ref } from 'vue'

const SESSION_KEY = 'gui-er-xue-zhi.session'

function readToken(): string {
  try {
    return typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}

// Token 仅保留在当前标签页会话中；记住登录表单由 loginPreferences 单独管理。
export const sessionToken = ref(readToken())
// 接口错误保留在内存中，跳转登录页后直接展示，不通过 URL 传递。
export const sessionErrorMessage = ref('')

export function setSessionToken(token: string): void {
  if (token) sessionErrorMessage.value = ''
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) sessionStorage.setItem(SESSION_KEY, token)
      else sessionStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // 存储不可用时仍可使用当前页面的内存会话。
  }
  sessionToken.value = token
}
