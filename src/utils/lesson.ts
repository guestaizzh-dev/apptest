import { ENTRY_ADVANCE_MINUTES, FINAL_STATUSES } from '@/constants/teaching'
import type { Lesson, LessonQuery } from '@/types/teaching'
import { minutesToTime, timeToMinutes } from './date'
import { normalizeTeacherTime } from './teacherHome'

export function isFinal(lesson: Lesson): boolean {
  return FINAL_STATUSES.includes(lesson.status)
}

/** 此判断用于客户端入口提示，正式课堂请求仍须由后端校验身份和进入权限。 */
export function canEnter(lesson: Lesson): boolean {
  if (lesson.bookingId !== undefined) {
    // 只允许打开真实排课的准备页；入房资格以 ZEGO join 的服务器校验为准。
    return (
      !lesson.roomClosed &&
      (lesson.status === 'unbuilt' || lesson.status === 'scheduled') &&
      Boolean(
        lesson.startTime &&
        lesson.endTime &&
        normalizeTeacherTime(lesson.startTime) &&
        normalizeTeacherTime(lesson.endTime) &&
        lesson.endTime > lesson.startTime,
      )
    )
  }
  return lesson.status === 'ready' || lesson.status === 'live'
}

export function courseName(lesson: Lesson): string {
  return `${lesson.grade ? `${lesson.grade} · ` : ''}${lesson.subject || '科目待补充'} 1 对 1`
}

export function entryTime(time: string): string {
  return minutesToTime(timeToMinutes(time) - ENTRY_ADVANCE_MINUTES)
}

export function avatarClass(student: string): string {
  if (student === '李四') return 'alt'
  if (student === '赵一') return 'green'
  return ''
}

/** 日期范围、关键词和状态各自判断，方便人工审核筛选规则。 */
export function matchesLessonQuery(lesson: Lesson, query: LessonQuery): boolean {
  const keyword = query.keyword.trim().toLowerCase()
  const matchesStatus = query.status === 'all' || lesson.status === query.status
  const searchableText = `${lesson.student}${courseName(lesson)}${lesson.date}`.toLowerCase()
  const matchesKeyword = !keyword || searchableText.includes(keyword)
  return matchesStatus && matchesKeyword
}

export function compareLessonTime(first: Lesson, second: Lesson): number {
  return (
    ((first.date || '9999') + first.start).localeCompare((second.date || '9999') + second.start) ||
    String(first.id).localeCompare(String(second.id), undefined, { numeric: true })
  )
}
