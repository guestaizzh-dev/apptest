import type { Lesson } from '@/types/teaching'
import type { TeacherCourse } from '@/types/teacherHome'
import type { TeacherSlot } from '@/types/teacherSchedule'
import { normalizeTeacherTime } from '@/utils/teacherHome'
import { timeToMinutes } from '@/utils/date'

export function toTeacherLesson(course: TeacherCourse, slot?: TeacherSlot): Lesson {
  const statuses: Record<number, Lesson['status']> = {
    0: 'unbuilt',
    1: 'scheduled',
    3: 'cancelled',
    4: 'completed',
  }
  return {
    id: course.bookingId,
    bookingId: course.bookingId,
    scheduleId: course.scheduleId,
    date: course.startTime?.slice(0, 10) || '',
    start: course.startTime?.slice(11, 16) || '',
    end: course.endTime?.slice(11, 16) || '',
    startTime: course.startTime,
    endTime: course.endTime,
    student: course.studentName,
    subject: course.subject,
    grade: course.grade,
    status: statuses[course.bookingStatus ?? -1] || 'unknown',
    bookingStatus: course.bookingStatus,
    hasCourseReport: course.hasCourseReport,
    hasClassFeedback: course.hasClassFeedback,
    studyManagerName: course.studyManagerName,
    bookingOperatorName: course.bookingOperatorName,
    bookVersion: slot?.bookVersion,
  }
}

export function validCalendarTime(start?: string | null, end?: string | null): boolean {
  return Boolean(
    start && end && normalizeTeacherTime(start) && normalizeTeacherTime(end) && end > start,
  )
}

export function slotStatus(slot: TeacherSlot): string {
  return (
    (
      { '0': '空闲可约', '1': '待审核占用', '2': '已建课占用', '3': '关闭 / 不可约' } as Record<
        string,
        string
      >
    )[slot.status] || '时段状态待确认'
  )
}

/** 跨午夜课程按天裁剪，0 点结束不在次日制造一块零时长课程。 */
export function clipCalendarTime(
  start: string,
  end: string,
  date: string,
): { start: number; end: number } | undefined {
  if (!validCalendarTime(start, end)) return undefined
  const startDate = start.slice(0, 10)
  const endDate = end.slice(0, 10)
  if (date < startDate || date > endDate) return undefined
  const from = date === startDate ? timeToMinutes(start.slice(11, 16)) : 0
  const to = date === endDate ? timeToMinutes(end.slice(11, 16)) : 1440
  return to > from ? { start: from, end: to } : undefined
}

export interface CalendarEvent {
  key: string
  lesson?: Lesson
  slot?: TeacherSlot
  start: number
  end: number
  lane: number
  lanes: number
}

/** 重叠课程分栏展示，点击区域互不覆盖；空闲/关闭时段不伪装成课程。 */
export function calendarEvents(
  lessons: Lesson[],
  slots: TeacherSlot[],
  date: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const bookedSchedules = new Set(
    lessons
      .filter((lesson) => [0, 1, 4, 5].includes(lesson.bookingStatus ?? -1))
      .map((lesson) => lesson.scheduleId),
  )
  for (const lesson of lessons) {
    if (!lesson.startTime || !lesson.endTime) continue
    const clipped = clipCalendarTime(lesson.startTime, lesson.endTime, date)
    if (clipped)
      events.push({ key: `booking:${lesson.id}:${date}`, lesson, ...clipped, lane: 0, lanes: 1 })
  }
  for (const slot of slots) {
    if (bookedSchedules.has(slot.scheduleId) || !slot.startTime || !slot.endTime) continue
    const clipped = clipCalendarTime(slot.startTime, slot.endTime, date)
    if (clipped)
      events.push({ key: `slot:${slot.scheduleId}:${date}`, slot, ...clipped, lane: 0, lanes: 1 })
  }
  events.sort(
    (first, second) =>
      first.start - second.start || first.end - second.end || first.key.localeCompare(second.key),
  )
  let group: CalendarEvent[] = []
  let groupEnd = -1
  function assignLanes(): void {
    const ends: number[] = []
    for (const event of group) {
      let lane = ends.findIndex((end) => end <= event.start)
      if (lane < 0) lane = ends.length
      ends[lane] = event.end
      event.lane = lane
    }
    for (const event of group) event.lanes = ends.length
    group = []
  }
  for (const event of events) {
    if (event.start >= groupEnd) {
      assignLanes()
      groupEnd = -1
    }
    group.push(event)
    groupEnd = Math.max(groupEnd, event.end)
  }
  assignLanes()
  return events
}
