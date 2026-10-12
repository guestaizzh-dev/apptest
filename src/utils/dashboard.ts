import type { Lesson } from '@/types/teaching'
import { compareLessonTime, canEnter } from './lesson'
import { weekDates } from './date'

/** 所有概览指标均从同一份课程数据计算；实际时长仅累计已完成课程。 */
export function summarizeDashboard(lessons: Lesson[], date: string) {
  const days = weekDates(date)
  const weekly = lessons.filter((lesson) => days.includes(lesson.date))
  const today = lessons.filter((lesson) => lesson.date === date).sort(compareLessonTime)
  const completed = weekly.filter((lesson) => lesson.status === 'completed')
  return {
    today,
    todayCompleted: today.filter((lesson) => lesson.status === 'completed').length,
    todayPending: today.filter((lesson) => lesson.status === 'pending' || lesson.status === 'ready')
      .length,
    todayLive: today.filter((lesson) => lesson.status === 'live').length,
    todayReady: today.filter(canEnter).length,
    weeklyTotal: weekly.length,
    weeklyCompleted: completed.length,
    weeklyPending: weekly.filter(
      (lesson) => lesson.status === 'pending' || lesson.status === 'ready',
    ).length,
    weeklyLive: weekly.filter((lesson) => lesson.status === 'live').length,
    weeklyCancelled: weekly.filter((lesson) => lesson.status === 'cancelled').length,
    weeklyMissed: weekly.filter((lesson) => lesson.status === 'missed').length,
    actualMinutes: completed.reduce((sum, lesson) => sum + (lesson.duration ?? 0), 0),
    days: days.map((day) => ({
      date: day,
      total: weekly.filter((lesson) => lesson.date === day).length,
      completed: weekly.filter((lesson) => lesson.date === day && lesson.status === 'completed')
        .length,
    })),
  }
}
