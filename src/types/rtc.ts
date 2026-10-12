/** Token 由 xueerguitu 签发，前端不保存 AppSecret。 */
export interface ClassroomCredentials {
  appId: number
  roomId: string
  userId: string
  streamId: string
  token: string
  expiresIn: number
  serverTime: string
  role: string
  teacherUserId?: string
  screenStreamId?: string | null
}

export type RtcPhase = 'idle' | 'joining' | 'publishing' | 'connected' | 'reconnecting' | 'error'

/** 离课返回的教师 ZEGO 事实汇总，不等同于课程完成或考勤结算。 */
export interface ClassroomAttendance {
  bookingId: string
  userId: string
  role: 'TEACHER'
  attendanceFlag: 0 | 1
  attendanceSeconds: number
  firstInTime: string | null
  lastOutTime: string | null
}

export interface RemoteParticipant {
  streamId: string
  userId: string
  userName: string
  playing: boolean
}

export interface ClassroomSnapshot {
  phase: RtcPhase
  message: string
  roomId: string
  videoEnabled: boolean
  audioEnabled: boolean
  speakerEnabled: boolean
  sharing: boolean
  shareBusy: boolean
  participants: RemoteParticipant[]
  leaving: boolean
  leaveError: string
  attendance?: ClassroomAttendance
}
