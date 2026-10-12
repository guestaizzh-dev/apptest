import { defineStore } from 'pinia'
import type { LessonId, ScheduleTab, ScheduleView, StatusFilter } from '@/types/teaching'
import { previousMonthStart } from '@/utils/date'

/** 查询上下文独立保存，离开课表再返回时不会丢失日期及筛选条件。 */
export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    tab: 'arrange' as ScheduleTab,
    view: 'week' as ScheduleView,
    date: '',
    selectedId: null as LessonId | null,
    arrangeSearch: '',
    arrangeStatus: 'all' as StatusFilter,
    recordSearch: '',
    recordStatus: 'all' as StatusFilter,
    from: '',
    to: '',
  }),
  actions: {
    initialize(serverDate: string) {
      if (this.date) return
      this.date = serverDate
      this.from = previousMonthStart(serverDate)
      this.to = serverDate
    },
  },
})
