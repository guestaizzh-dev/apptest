import type { LessonStatus, ScheduleView } from '@/types/teaching'

export const STATUS_LABELS: Record<LessonStatus, string> = {
  pending: '待上课',
  ready: '可进入',
  live: '上课中',
  completed: '已完成',
  cancelled: '已取消',
  missed: '未上课',
  unbuilt: '待建课',
  scheduled: '已建课',
  unknown: '状态待确认',
}

export const FINAL_STATUSES: LessonStatus[] = ['completed', 'cancelled', 'missed']
export const ALL_STATUSES = Object.keys(STATUS_LABELS) as LessonStatus[]
export const TEACHER_STATUSES: LessonStatus[] = [
  'unbuilt',
  'scheduled',
  'completed',
  'cancelled',
  'unknown',
]
export const TEACHER_FINAL_STATUSES: LessonStatus[] = ['completed', 'cancelled']
export const SCHEDULE_VIEWS: { id: ScheduleView; label: string }[] = [
  { id: 'week', label: '周' },
  { id: 'day', label: '日' },
  { id: 'list', label: '列表' },
]

/** 时间轴每小时 72px；兼顾多时段浏览和 40 分钟课程信息。 */
export const CALENDAR_START_HOUR = 14
export const CALENDAR_HOUR_COUNT = 9
export const CALENDAR_HOUR_HEIGHT = 72

/** 仅用于解释当前演示配置；正式允许进入时间应由服务端返回。 */
export const ENTRY_ADVANCE_MINUTES = 10
