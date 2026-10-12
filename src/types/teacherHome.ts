/** 教师课程接口的显示模型。ID 始终保留为字符串，不用于模拟课表。 */
export interface TeacherCourse {
  bookingId: string
  scheduleId?: string
  courseType?: number
  bookingType?: number
  bookingStatus?: number
  subject: string
  grade: string
  studentName: string
  startTime: string | null
  endTime: string | null
  bookingOperatorName: string
  studyManagerName: string
  hasCourseReport: boolean | null
  hasClassFeedback: boolean | null
}

export interface TeacherCourseQuery {
  dateStart?: string
  dateEnd?: string
  bookingStatus?: number
}

export interface TeacherHomeData {
  weekCourses: TeacherCourse[]
  upcomingCourses: TeacherCourse[]
  recentCourses: TeacherCourse[]
}
