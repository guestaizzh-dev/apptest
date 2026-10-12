import { backendHttp, RequestError } from '@/services/http'
import type { ApiResult } from '@/types/auth'
import type { TeacherCourse, TeacherCourseQuery, TeacherHomeData } from '@/types/teacherHome'
import { compareTeacherCourses, homeDateRanges, normalizeTeacherTime } from '@/utils/teacherHome'

export function teacherIdentifier(value: unknown): string | undefined {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return undefined
    return String(value)
  }
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : undefined
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
function integer(value: unknown): number | undefined {
  return Number.isInteger(value) ? (value as number) : undefined
}
function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeCourse(value: unknown): TeacherCourse {
  if (!value || typeof value !== 'object') throw new RequestError('课程响应格式不正确。')
  const row = value as Record<string, unknown>
  const bookingId = teacherIdentifier(row.bookingId)
  if (!bookingId)
    throw new RequestError('课程响应缺少有效排课编号，或编号超出数字精度，请联系管理员。')
  return {
    bookingId,
    scheduleId: teacherIdentifier(row.scheduleId),
    courseType: integer(row.courseType),
    bookingType: integer(row.bookingType),
    bookingStatus: integer(row.bookingStatus),
    subject: text(row.courseSubject),
    grade: text(row.courseGrade),
    studentName: text(row.childName) || text(row.customerName) || '姓名待补充',
    startTime: normalizeTeacherTime(row.classStartTime),
    endTime: normalizeTeacherTime(row.classEndTime),
    bookingOperatorName: text(row.bookingOperatorName),
    studyManagerName: text(row.studyManagerName),
    hasCourseReport: flag(row.hasCourseReport),
    hasClassFeedback: flag(row.hasClassFeedback),
  }
}

/** 拉完指定范围的所有分页，再排序与统计；不把首屏数量当作全量。 */
export async function fetchTeacherCourses(
  query: TeacherCourseQuery,
  signal?: AbortSignal,
): Promise<TeacherCourse[]> {
  const courses = new Map<string, TeacherCourse>()
  let seenRows = 0
  let expectedTotal: number | undefined
  for (let pageNum = 1; pageNum <= 1000; pageNum++) {
    const { data } = await backendHttp.get<
      ApiResult<{ total: number; rows: unknown[]; pageNum: number; pageSize: number }>
    >('/teacher/courses', {
      params: { ...query, pageNum, pageSize: 100 },
      headers: { 'X-Active-Role': 'teacher' },
      signal,
    })
    const page = data.data
    if (!page || !Array.isArray(page.rows) || !Number.isSafeInteger(page.total) || page.total < 0)
      throw new RequestError('教师课程分页响应不完整，请联系管理员。')
    if (page.pageNum !== pageNum || !Number.isSafeInteger(page.pageSize) || page.pageSize <= 0)
      throw new RequestError('教师课程分页信息不正确，请联系管理员。')
    if (expectedTotal !== undefined && page.total !== expectedTotal)
      throw new RequestError('课程列表在加载过程中发生变化，请刷新重试。')
    expectedTotal = page.total
    const previousSize = courses.size
    for (const row of page.rows) {
      const course = normalizeCourse(row)
      courses.set(course.bookingId, course)
    }
    seenRows += page.rows.length
    if (seenRows >= page.total && courses.size >= page.total)
      return [...courses.values()].sort(compareTeacherCourses)
    if (!page.rows.length || previousSize === courses.size)
      throw new RequestError('课程分页数据不完整，请刷新重试。')
  }
  throw new RequestError('课程数据页数过多，请缩小查询范围。')
}

export async function fetchTeacherHome(
  date: string,
  signal?: AbortSignal,
): Promise<TeacherHomeData> {
  const ranges = homeDateRanges(date)
  const [weekCourses, upcomingCourses, recentCourses] = await Promise.all([
    fetchTeacherCourses(ranges.week, signal),
    fetchTeacherCourses(ranges.upcoming, signal),
    fetchTeacherCourses(ranges.recent, signal),
  ])
  return { weekCourses, upcomingCourses, recentCourses }
}
