import { backendHttp, RequestError } from '@/services/http'
import { fetchTeacherCourses, teacherIdentifier } from '@/api/teacherHome'
import type { ApiResult } from '@/types/auth'
import type { Lesson, LessonId } from '@/types/teaching'
import type { TeacherSlot, TeachingRange, TeachingRangeData } from '@/types/teacherSchedule'
import { normalizeTeacherTime } from '@/utils/teacherHome'
import { toTeacherLesson } from '@/utils/teacherSchedule'
import { addDays } from '@/utils/date'

export async function fetchTeacherWeek(
  weekStart: string,
  signal?: AbortSignal,
): Promise<TeacherSlot[]> {
  const { data } = await backendHttp.get<ApiResult<unknown[]>>('/teacher/schedules/week', {
    params: { weekStart },
    headers: { 'X-Active-Role': 'teacher' },
    signal,
  })
  if (!Array.isArray(data.data)) throw new RequestError('周课表响应格式不正确。')
  const ids = new Set<string>()
  return data.data.map((value) => {
    if (!value || typeof value !== 'object') throw new RequestError('课表时段响应格式不正确。')
    const row = value as Record<string, unknown>
    const scheduleId = teacherIdentifier(row.scheduleId)
    if (!scheduleId || ids.has(scheduleId)) throw new RequestError('课表时段编号无效或重复。')
    ids.add(scheduleId)
    return {
      scheduleId,
      bookingId: teacherIdentifier(row.bookingId),
      status: typeof row.status === 'string' ? row.status : '',
      title: typeof row.title === 'string' ? row.title.trim() : '',
      startTime: normalizeTeacherTime(row.startTime),
      endTime: normalizeTeacherTime(row.endTime),
      bookVersion: typeof row.bookVersion === 'string' ? row.bookVersion.trim() : '',
    }
  })
}

export async function fetchTeachingRange(
  range: TeachingRange,
  signal?: AbortSignal,
): Promise<TeachingRangeData> {
  const slots = range.weekStart ? await fetchTeacherWeek(range.weekStart, signal) : []
  // 周接口包含跨日时段；课程接口按开始日期过滤，补齐最早重叠时段及前一天。
  const from = range.weekStart
    ? slots.reduce(
        (earliest, slot) =>
          slot.startTime && slot.startTime.slice(0, 10) < earliest
            ? slot.startTime.slice(0, 10)
            : earliest,
        addDays(range.from, -1),
      )
    : range.from
  const courses = await fetchTeacherCourses({ dateStart: from, dateEnd: range.to }, signal)
  return {
    lessons: courses.map((course) =>
      toTeacherLesson(
        course,
        slots.find(
          (slot) => slot.scheduleId === course.scheduleId && slot.bookingId === course.bookingId,
        ),
      ),
    ),
    slots,
  }
}

/** 未提供单课详情接口；只从当前教师拥有的课程列表查找，保留完整 ID。 */
export async function fetchOwnedLesson(
  id: LessonId,
  date?: string,
  signal?: AbortSignal,
): Promise<Lesson | undefined> {
  if (!teacherIdentifier(id)) throw new RequestError('排课编号无效。')
  const courses = await fetchTeacherCourses(date ? { dateStart: date, dateEnd: date } : {}, signal)
  const course = courses.find((item) => item.bookingId === String(id))
  return course ? toTeacherLesson(course) : undefined
}
