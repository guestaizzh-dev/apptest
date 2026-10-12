import { addDays, weekDates } from '@/utils/date'
import type { TeacherCourse } from '@/types/teacherHome'

/** 教师接口无 serverTime；仅用于日期筛选与问候，不推导入课资格。 */
export function shanghaiClock(now = Date.now()): { date: string; time: string } {
  const local = new Date(now + 8 * 60 * 60 * 1000).toISOString()
  return { date: local.slice(0, 10), time: local.slice(11, 19) }
}

/** 服务端 yyyy-MM-dd HH:mm:ss 明确按上海时区解析，避免浏览器所在地改变日期。 */
export function normalizeTeacherTime(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value))
    return null
  const canonical = value.replace('T', ' ')
  const epoch = Date.parse(`${canonical.replace(' ', 'T')}+08:00`)
  if (!Number.isFinite(epoch)) return null
  const clock = shanghaiClock(epoch)
  return `${clock.date} ${clock.time}` === canonical ? canonical : null
}

export function teacherCourseStatus(course: TeacherCourse): { text: string; tone: string } {
  const states: Record<number, { text: string; tone: string }> = {
    0: { text: '待建课', tone: 'pending' },
    1: { text: '已建课', tone: 'scheduled' },
    3: { text: '已取消', tone: 'cancelled' },
    4: { text: '已完成', tone: 'completed' },
  }
  return states[course.bookingStatus ?? -1] ?? { text: '状态待确认', tone: 'unknown' }
}

export function teacherCourseName(course: TeacherCourse): string {
  return [course.grade, course.subject].filter(Boolean).join(' · ') || '课程信息待补充'
}

export function compareTeacherCourses(first: TeacherCourse, second: TeacherCourse): number {
  return (
    (first.startTime || '9999').localeCompare(second.startTime || '9999') ||
    first.bookingId.localeCompare(second.bookingId, undefined, { numeric: true })
  )
}

export function homeDateRanges(date: string) {
  const dates = weekDates(date)
  return {
    week: { dateStart: dates[0]!, dateEnd: dates[6]! },
    upcoming: { dateStart: date, dateEnd: addDays(date, 60) },
    recent: { dateStart: addDays(date, -29), dateEnd: date, bookingStatus: 4 },
  }
}

export function summarizeTeacherHome(courses: TeacherCourse[], date: string) {
  const dates = weekDates(date)
  const week = courses.filter((course) => dates.includes(course.startTime?.slice(0, 10) || ''))
  const today = week
    .filter((course) => course.startTime?.slice(0, 10) === date)
    .sort(compareTeacherCourses)
  const isPending = (course: TeacherCourse) =>
    course.bookingStatus === 0 || course.bookingStatus === 1
  return {
    today,
    todayPending: today.filter(isPending).length,
    todayCompleted: today.filter((course) => course.bookingStatus === 4).length,
    todayCancelled: today.filter((course) => course.bookingStatus === 3).length,
    weeklyTotal: week.length,
    weeklyCompleted: week.filter((course) => course.bookingStatus === 4).length,
    weeklyPending: week.filter(isPending).length,
    weeklyCancelled: week.filter((course) => course.bookingStatus === 3).length,
    days: dates.map((day) => ({
      date: day,
      total: week.filter((course) => course.startTime?.slice(0, 10) === day).length,
      completed: week.filter(
        (course) => course.startTime?.slice(0, 10) === day && course.bookingStatus === 4,
      ).length,
    })),
  }
}
