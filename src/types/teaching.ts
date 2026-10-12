/** 排课状态由接口返回；页面只负责展示，不依赖本地时钟推导业务状态。 */
export type LessonStatus =
  | 'pending'
  | 'ready'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'missed'
  | 'unbuilt'
  | 'scheduled'
  | 'unknown'
export type LessonId = string | number
export type ScheduleView = 'week' | 'day' | 'list'
export type ScheduleTab = 'arrange' | 'records'
export type StatusFilter = LessonStatus | 'all'

/** 一条具体排课，不是一门长期课程；id 同时用于详情、课堂和上课记录。 */
export interface Lesson {
  id: LessonId
  /** 后端真实排课主键；示例课程不填，禁止自动拿前端 id 入房。 */
  bookingId?: LessonId
  scheduleId?: string
  startTime?: string | null
  endTime?: string | null
  grade?: string
  bookingStatus?: number
  hasCourseReport?: boolean | null
  hasClassFeedback?: boolean | null
  studyManagerName?: string
  bookingOperatorName?: string
  bookVersion?: string
  roomClosed?: boolean
  date: string
  start: string
  end: string
  student: string
  subject: string
  status: LessonStatus
  actualStart?: string
  actualEnd?: string
  duration?: number
  reason?: string
}

export interface Teacher {
  name: string
  role: string
}

/** 当前为前端约定的响应形状，正式接入时在 API 层适配后端字段。 */
export interface TeachingOverview {
  teacher: Teacher
  lessons: Lesson[]
  serverDate: string
  serverTime: string
}

export interface LessonQuery {
  keyword: string
  status: StatusFilter
}
