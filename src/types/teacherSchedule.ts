import type { Lesson } from '@/types/teaching'

export interface TeacherSlot {
  scheduleId: string
  bookingId?: string
  status: string
  title: string
  startTime: string | null
  endTime: string | null
  bookVersion: string
}
export interface TeachingRange {
  from: string
  to: string
  weekStart?: string
}
export interface TeachingRangeData {
  lessons: Lesson[]
  slots: TeacherSlot[]
}
