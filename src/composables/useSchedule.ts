import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  TEACHER_STATUSES,
  TEACHER_FINAL_STATUSES,
  CALENDAR_HOUR_HEIGHT,
} from '@/constants/teaching'
import { useScheduleStore } from '@/stores/schedule'
import { useTeachingStore } from '@/stores/teaching'
import { useUiStore } from '@/stores/ui'
import type { Lesson, ScheduleTab } from '@/types/teaching'
import { addDays, dayName, formatDate, previousMonthStart, weekDates } from '@/utils/date'
import { canEnter, compareLessonTime, isFinal, matchesLessonQuery } from '@/utils/lesson'
import {
  calendarEvents,
  clipCalendarTime,
  slotStatus,
  type CalendarEvent,
} from '@/utils/teacherSchedule'
import type { TeachingRange } from '@/types/teacherSchedule'

export function useSchedule() {
  const state = useScheduleStore()
  const teaching = useTeachingStore()
  const ui = useUiStore()
  const route = useRoute()
  const router = useRouter()
  state.initialize(teaching.serverDate)
  const dates = computed(() => weekDates(state.date))
  const search = computed({
    get: () => (state.tab === 'records' ? state.recordSearch : state.arrangeSearch),
    set: (value) => {
      if (state.tab === 'records') state.recordSearch = value
      else state.arrangeSearch = value
    },
  })
  const status = computed({
    get: () => (state.tab === 'records' ? state.recordStatus : state.arrangeStatus),
    set: (value) => {
      if (state.tab === 'records') state.recordStatus = value
      else state.arrangeStatus = value
    },
  })
  const statusOptions = computed(() =>
    state.tab === 'records' ? TEACHER_FINAL_STATUSES : TEACHER_STATUSES,
  )
  function validDate(value: unknown): value is string {
    return (
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value
    )
  }
  watch(
    () => [route.query.tab, route.query.lesson, route.query.date, route.query.view],
    () => {
      if (route.query.tab === 'records' || route.query.tab === 'arrange')
        state.tab = route.query.tab
      if (validDate(route.query.date)) {
        if (state.tab === 'arrange') state.date = route.query.date
        else {
          if (route.query.date < state.from) state.from = route.query.date
          if (route.query.date > state.to) state.to = route.query.date
        }
        search.value = ''
        status.value = 'all'
      }
      if (route.query.view === 'day' || route.query.view === 'week') state.view = route.query.view
      if (typeof route.query.lesson === 'string') state.selectedId = route.query.lesson
    },
    { immediate: true },
  )
  const range = computed<TeachingRange>(() =>
    state.tab === 'records'
      ? { from: state.from, to: state.to }
      : { from: dates.value[0]!, to: dates.value[6]!, weekStart: dates.value[0]! },
  )
  async function refresh(force = true): Promise<void> {
    try {
      await teaching.loadRange(range.value, force)
    } catch {
      /* 页面显示可重试错误 */
    }
  }
  watch(
    () => JSON.stringify(range.value),
    () => void refresh(),
    { immediate: true },
  )
  const visibleLessons = computed(() =>
    teaching.lessons
      .filter((lesson) => {
        const displayed = state.view === 'day' ? [state.date] : dates.value
        const inRange =
          state.tab === 'records'
            ? isFinal(lesson) &&
              (!lesson.date || (lesson.date >= state.from && lesson.date <= state.to))
            : !lesson.date ||
              displayed.includes(lesson.date) ||
              displayed.some(
                (date) =>
                  lesson.startTime &&
                  lesson.endTime &&
                  clipCalendarTime(lesson.startTime, lesson.endTime, date),
              )
        return (
          inRange && matchesLessonQuery(lesson, { keyword: search.value, status: status.value })
        )
      })
      .sort(state.tab === 'records' ? (a, b) => compareLessonTime(b, a) : compareLessonTime),
  )
  watch(
    [visibleLessons, () => teaching.initialized],
    ([items, ready]) => {
      if (!ready) return
      const routeLesson =
        typeof route.query.lesson === 'string'
          ? items.find((lesson) => String(lesson.id) === route.query.lesson)
          : undefined
      if (routeLesson) state.selectedId = routeLesson.id
      else if (!items.some((lesson) => String(lesson.id) === String(state.selectedId)))
        state.selectedId = items.find(canEnter)?.id ?? items[0]?.id ?? null
    },
    { immediate: true },
  )
  const selected = computed(() =>
    visibleLessons.value.find((lesson) => String(lesson.id) === String(state.selectedId)),
  )
  const dailyLessons = computed(() =>
    teaching.lessons.filter((lesson) => lesson.date === state.date),
  )
  const recordCount = computed(() =>
    state.tab === 'records' && teaching.initialized
      ? teaching.lessons.filter(isFinal).length
      : null,
  )
  const completedCount = computed(
    () => visibleLessons.value.filter((lesson) => lesson.status === 'completed').length,
  )
  const totalMinutes = computed(() => {
    const completed = visibleLessons.value.filter((lesson) => lesson.status === 'completed')
    return completed.length && completed.every((lesson) => lesson.duration !== undefined)
      ? completed.reduce((sum, lesson) => sum + (lesson.duration ?? 0), 0)
      : '—'
  })
  const dateLabel = computed(() =>
    state.view === 'day'
      ? `${formatDate(state.date)} ${dayName(state.date)}`
      : `${formatDate(dates.value[0]!)} — ${formatDate(dates.value[6]!)}`,
  )
  const calendarColumns = computed(() => {
    const booked = new Set(
      teaching.lessons
        .filter((lesson) => [0, 1, 4, 5].includes(lesson.bookingStatus ?? -1))
        .map((lesson) => lesson.scheduleId),
    )
    const slots =
      search.value || status.value !== 'all'
        ? []
        : teaching.slots.filter((slot) => !booked.has(slot.scheduleId))
    return (state.view === 'week' ? dates.value : [state.date]).map((date) => ({
      date,
      events: calendarEvents(visibleLessons.value, slots, date),
    }))
  })
  const calendarStart = computed(() =>
    Math.floor(
      Math.min(
        8 * 60,
        ...calendarColumns.value.flatMap((column) => column.events.map((event) => event.start)),
      ) / 60,
    ),
  )
  const calendarEnd = computed(() =>
    Math.ceil(
      Math.max(
        22 * 60,
        ...calendarColumns.value.flatMap((column) => column.events.map((event) => event.end)),
      ) / 60,
    ),
  )
  const calendarHours = computed(() =>
    Array.from(
      { length: calendarEnd.value - calendarStart.value },
      (_, index) => calendarStart.value + index,
    ),
  )
  const calendarHeight = computed(
    () => `${(calendarEnd.value - calendarStart.value) * CALENDAR_HOUR_HEIGHT}px`,
  )
  function eventStyle(event: CalendarEvent) {
    return {
      top: `${((event.start - calendarStart.value * 60) * CALENDAR_HOUR_HEIGHT) / 60}px`,
      height: `${((event.end - event.start) * CALENDAR_HOUR_HEIGHT) / 60}px`,
      left: `calc(${(event.lane * 100) / event.lanes}% + 3px)`,
      right: 'auto',
      width: `calc(${100 / event.lanes}% - 6px)`,
    }
  }
  function selectEvent(event: CalendarEvent): void {
    if (event.lesson) state.selectedId = event.lesson.id
    else if (event.slot)
      ui.notify(
        `${slotStatus(event.slot)} · ${event.slot.startTime} — ${event.slot.endTime}。时段为只读信息。`,
      )
  }
  function switchTab(tab: ScheduleTab): void {
    state.tab = tab
    void router.replace({ name: 'schedule', query: { tab } })
  }
  function shift(amount: number): void {
    state.date = addDays(state.date, amount * (state.view === 'day' ? 1 : 7))
  }
  function resetFilters(): void {
    search.value = ''
    status.value = 'all'
    if (state.tab === 'records') {
      state.from = previousMonthStart(teaching.serverDate)
      state.to = teaching.serverDate
    }
  }
  function updateRange(event: Event, key: 'from' | 'to'): void {
    const input = event.target as HTMLInputElement
    if (
      !validDate(input.value) ||
      (key === 'from' ? input.value > state.to : input.value < state.from)
    ) {
      ui.notify('开始日期不能晚于结束日期，且日期不能为空。')
      input.value = state[key]
      return
    }
    state[key] = input.value
  }
  function enter(lesson: Lesson): void {
    if (canEnter(lesson))
      void router.push({
        name: 'classroom',
        params: { id: String(lesson.id) },
        query: { date: lesson.date },
      })
  }
  function selectDailyLesson(lesson: Lesson): void {
    state.arrangeSearch = ''
    state.arrangeStatus = 'all'
    state.selectedId = lesson.id
  }
  return {
    state,
    teaching,
    dates,
    search,
    status,
    statusOptions,
    visibleLessons,
    selected,
    dailyLessons,
    recordCount,
    completedCount,
    totalMinutes,
    dateLabel,
    calendarColumns,
    calendarHours,
    calendarStart,
    calendarHeight,
    refresh,
    selectEvent,
    switchTab,
    shift,
    resetFilters,
    updateRange,
    enter,
    selectDailyLesson,
    eventStyle,
  }
}
