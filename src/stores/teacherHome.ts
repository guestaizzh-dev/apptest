import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { fetchTeacherHome } from '@/api/teacherHome'
import { sessionToken } from '@/services/session'
import type { TeacherHomeData } from '@/types/teacherHome'
import { compareTeacherCourses, shanghaiClock, summarizeTeacherHome } from '@/utils/teacherHome'

function emptyData(): TeacherHomeData {
  return { weekCourses: [], upcomingCourses: [], recentCourses: [] }
}

export const useTeacherHomeStore = defineStore('teacherHome', () => {
  const data = ref(emptyData())
  const date = ref(shanghaiClock().date)
  const time = ref(shanghaiClock().time)
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref('')
  const updatedAt = ref('')
  let generation = 0
  let request: Promise<void> | undefined
  let controller: AbortController | undefined
  const summary = computed(() => summarizeTeacherHome(data.value.weekCourses, date.value))
  const nextCourse = computed(
    () =>
      data.value.upcomingCourses
        .filter(
          (course) =>
            (course.bookingStatus === 0 || course.bookingStatus === 1) &&
            course.startTime &&
            course.endTime &&
            course.endTime >= `${date.value} ${time.value}`,
        )
        .sort(compareTeacherCourses)[0],
  )
  const recentCourses = computed(() =>
    data.value.recentCourses
      .filter((course) => course.bookingStatus === 4)
      .sort((first, second) => compareTeacherCourses(second, first))
      .slice(0, 3),
  )
  const incompleteCount = computed(() => {
    const rows = new Map(
      [...data.value.weekCourses, ...data.value.upcomingCourses, ...data.value.recentCourses].map(
        (course) => [course.bookingId, course],
      ),
    )
    return [...rows.values()].filter((course) => !course.startTime || !course.endTime).length
  })

  function reset(): void {
    generation++
    controller?.abort()
    controller = undefined
    request = undefined
    data.value = emptyData()
    initialized.value = false
    loading.value = false
    errorMessage.value = ''
    updatedAt.value = ''
  }
  watch(
    sessionToken,
    (token, previous) => {
      if (token !== previous) reset()
    },
    { flush: 'sync' },
  )

  function load(force = false): Promise<void> {
    if (request) return request
    const clock = shanghaiClock()
    if (!force && initialized.value && date.value === clock.date) return Promise.resolve()
    const currentGeneration = generation
    const token = sessionToken.value
    if (!token) return Promise.reject(new Error('请先登录教师账号。'))
    controller = new AbortController()
    loading.value = true
    errorMessage.value = ''
    request = fetchTeacherHome(clock.date, controller.signal)
      .then((result) => {
        if (generation !== currentGeneration || sessionToken.value !== token) return
        data.value = result
        date.value = clock.date
        time.value = shanghaiClock().time
        updatedAt.value = time.value.slice(0, 5)
        initialized.value = true
      })
      .catch((error: unknown) => {
        if (generation !== currentGeneration || sessionToken.value !== token) return
        controller?.abort()
        errorMessage.value =
          error instanceof Error ? error.message : '首页数据加载失败，请稍后重试。'
        throw error
      })
      .finally(() => {
        if (generation !== currentGeneration) return
        request = undefined
        controller = undefined
        loading.value = false
      })
    return request
  }
  return {
    data,
    date,
    time,
    initialized,
    loading,
    errorMessage,
    updatedAt,
    summary,
    nextCourse,
    recentCourses,
    incompleteCount,
    load,
    reset,
  }
})
