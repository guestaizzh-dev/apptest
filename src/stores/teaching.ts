import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { fetchTeachingRange, fetchOwnedLesson } from '@/api/teaching'
import type { Lesson, LessonId } from '@/types/teaching'
import type { TeacherSlot, TeachingRange } from '@/types/teacherSchedule'
import { canEnter, compareLessonTime, isFinal } from '@/utils/lesson'
import { weekDates } from '@/utils/date'
import { shanghaiClock } from '@/utils/teacherHome'
import { sessionToken } from '@/services/session'
import { useAuthStore } from '@/stores/auth'

export const useTeachingStore = defineStore('teaching', () => {
  const lessons = ref<Lesson[]>([])
  const slots = ref<TeacherSlot[]>([])
  const knownLessons = ref<Record<string, Lesson>>({})
  const closedRooms = new Set<string>()
  const auth = useAuthStore()
  const teacher = computed(() => ({ name: auth.user?.userName || '', role: '教师' }))
  // 日期仅用于查询，不作为入房授权时钟。
  const serverDate = ref(shanghaiClock().date)
  const initialized = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  let generation = 0
  let sessionGeneration = 0
  let controller: AbortController | undefined
  let currentRange: TeachingRange | undefined
  let inFlight: Promise<void> | undefined
  const nextLesson = computed(() => lessons.value.filter(canEnter).sort(compareLessonTime)[0])
  const todayLessons = computed(() =>
    lessons.value.filter((lesson) => lesson.date === serverDate.value),
  )
  const recentLessons = computed(() =>
    lessons.value
      .filter(isFinal)
      .sort((a, b) => compareLessonTime(b, a))
      .slice(0, 2),
  )

  function remember(lesson: Lesson): Lesson {
    if (closedRooms.has(String(lesson.id))) lesson.roomClosed = true
    knownLessons.value[String(lesson.id)] = lesson
    return lesson
  }
  function loadRange(range: TeachingRange, force = false): Promise<void> {
    if (!sessionToken.value) return Promise.reject(new Error('请先登录教师账号。'))
    serverDate.value = shanghaiClock().date
    if (!force && JSON.stringify(currentRange) === JSON.stringify(range)) {
      if (inFlight) return inFlight
      if (initialized.value) return Promise.resolve()
    }
    controller?.abort()
    const requestController = new AbortController()
    controller = requestController
    const requestGeneration = ++generation
    currentRange = { ...range }
    loading.value = true
    initialized.value = false
    lessons.value = []
    slots.value = []
    errorMessage.value = ''
    const pending = fetchTeachingRange(range, requestController.signal)
      .then((result) => {
        if (requestGeneration !== generation) return
        lessons.value = result.lessons.map(remember)
        slots.value = result.slots
        initialized.value = true
      })
      .catch((error: unknown) => {
        if (requestGeneration !== generation) return
        errorMessage.value = error instanceof Error ? error.message : '课表加载失败。'
        throw error
      })
      .finally(() => {
        if (requestGeneration !== generation) return
        loading.value = false
        inFlight = undefined
      })
    inFlight = pending
    return pending
  }
  function getLesson(id: LessonId): Lesson | undefined {
    return knownLessons.value[String(id)]
  }
  async function ensureLesson(id: LessonId, date?: string): Promise<Lesson | undefined> {
    const token = sessionToken.value
    if (!token) throw new Error('请先登录教师账号。')
    const currentSession = sessionGeneration
    // 每次打开课堂重新校验所属课程与排课状态。
    const lesson = await fetchOwnedLesson(id, date)
    if (token !== sessionToken.value || currentSession !== sessionGeneration) return undefined
    if (lesson) return remember(lesson)
    delete knownLessons.value[String(id)]
    return undefined
  }
  function markRoomClosed(id: LessonId): void {
    closedRooms.add(String(id))
    const lesson = getLesson(id)
    if (lesson) lesson.roomClosed = true
    const visible = lessons.value.find((item) => String(item.id) === String(id))
    if (visible) visible.roomClosed = true
  }
  function reset(): void {
    sessionGeneration++
    generation++
    controller?.abort()
    controller = undefined
    currentRange = undefined
    inFlight = undefined
    lessons.value = []
    slots.value = []
    knownLessons.value = {}
    closedRooms.clear()
    initialized.value = false
    loading.value = false
    errorMessage.value = ''
    serverDate.value = shanghaiClock().date
  }
  watch(
    sessionToken,
    (token, previous) => {
      if (token !== previous) reset()
    },
    { flush: 'sync' },
  )
  function weekSummary(date: string) {
    const dates = weekDates(date)
    const items = lessons.value.filter((lesson) => dates.includes(lesson.date))
    return {
      total: items.length,
      completed: items.filter((lesson) => lesson.status === 'completed').length,
      pending: items.filter(
        (lesson) => lesson.status === 'scheduled' || lesson.status === 'unbuilt',
      ).length,
    }
  }
  return {
    lessons,
    slots,
    teacher,
    serverDate,
    initialized,
    loading,
    errorMessage,
    nextLesson,
    todayLessons,
    recentLessons,
    loadRange,
    ensureLesson,
    markRoomClosed,
    getLesson,
    reset,
    weekSummary,
  }
})
