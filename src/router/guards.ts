import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import { pinia } from '@/stores'
import { useScheduleStore } from '@/stores/schedule'
import { useTeachingStore } from '@/stores/teaching'
import { useUiStore } from '@/stores/ui'
import { canEnter } from '@/utils/lesson'
import { useAuthStore } from '@/stores/auth'
import { sessionToken } from '@/services/session'
import { safeLoginRedirect } from '@/utils/auth'

export function registerRouterGuards(router: Router, stores: Pinia = pinia): void {
  router.beforeEach(async (to) => {
    if (to.name === 'not-found') return true

    const auth = useAuthStore(stores)
    if (to.name === 'login') {
      if (auth.authenticated) return safeLoginRedirect(to.query.redirect)
      return true
    }
    if (!sessionToken.value) return { name: 'login', query: { redirect: to.fullPath } }
    try {
      await auth.restoreSession()
    } catch {
      return {
        name: 'login',
        query: {
          redirect: to.fullPath,
        },
      }
    }
    if (!auth.authenticated) return { name: 'login', query: { redirect: to.fullPath } }

    const teaching = useTeachingStore(stores)
    useScheduleStore(stores).initialize(teaching.serverDate)
    if (to.name !== 'classroom') return true
    const ui = useUiStore(stores)
    try {
      const date =
        typeof to.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.query.date)
          ? to.query.date
          : undefined
      const lesson = await teaching.ensureLesson(String(to.params.id), date)
      if (!lesson || !canEnter(lesson)) {
        ui.notify(lesson ? '当前课程暂无法准备上课，请查看排课状态。' : '未找到属于你的排课。')
        return {
          name: 'schedule',
          query: lesson ? { tab: 'arrange', lesson: String(lesson.id), date: lesson.date } : {},
        }
      }
      return true
    } catch (error) {
      if (!sessionToken.value) return { name: 'login', query: { redirect: to.fullPath } }
      ui.notify(error instanceof Error ? error.message : '课程校验失败，请刷新课表重试。')
      return { name: 'schedule' }
    }
  })
}
