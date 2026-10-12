import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { teacherLogin, fetchCurrentUser, logoutSession } from '@/api/auth'
import { sessionErrorMessage, sessionToken, setSessionToken } from '@/services/session'
import { RequestError } from '@/services/http'
import type { AuthUser, LoginIdentity } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const submitting = ref(false)
  const loggingOut = ref(false)
  const errorMessage = sessionErrorMessage
  const authenticated = computed(() =>
    Boolean(sessionToken.value && user.value?.roles.some((role) => role.code === 'teacher')),
  )
  let restoration: Promise<void> | undefined

  watch(sessionToken, (token) => {
    if (!token) user.value = null
  })

  async function login(identity: LoginIdentity): Promise<void> {
    if (submitting.value) return
    errorMessage.value = ''
    submitting.value = true
    try {
      const response = await teacherLogin(identity)
      user.value = response.user
      setSessionToken(response.token)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试。'
      throw error
    } finally {
      submitting.value = false
    }
  }

  function restoreSession(): Promise<void> {
    if (authenticated.value || !sessionToken.value) return Promise.resolve()
    if (restoration) return restoration
    const token = sessionToken.value
    restoration = fetchCurrentUser()
      .then((currentUser) => {
        if (sessionToken.value === token) {
          user.value = currentUser
          errorMessage.value = ''
        }
      })
      .catch((error: unknown) => {
        if (sessionToken.value === token || !sessionToken.value)
          errorMessage.value =
            error instanceof Error ? error.message : '暂时无法验证登录状态，请稍后重试。'
        throw error
      })
      .finally(() => {
        restoration = undefined
      })
    return restoration
  }

  async function logout(): Promise<void> {
    if (loggingOut.value) return
    loggingOut.value = true
    try {
      await logoutSession()
      setSessionToken('')
      user.value = null
    } catch (error) {
      if (!(error instanceof RequestError && error.status === 401)) throw error
      setSessionToken('')
      user.value = null
    } finally {
      loggingOut.value = false
    }
    errorMessage.value = ''
  }

  return {
    user,
    submitting,
    loggingOut,
    errorMessage,
    authenticated,
    login,
    restoreSession,
    logout,
  }
})
