import { backendHttp } from '@/services/http'
import type { ClassroomAttendance, ClassroomCredentials } from '@/types/rtc'
import { sessionToken } from '@/services/session'
import { normalizeTeacherTime } from '@/utils/teacherHome'

export function requireBookingId(bookingId: number | string): void {
  if (
    typeof bookingId === 'number'
      ? !Number.isSafeInteger(bookingId) || bookingId <= 0
      : !/^[1-9]\d*$/.test(bookingId)
  ) {
    throw new Error('请提供真实有效的排课 ID。')
  }
}

export function validateCredentials(value: ClassroomCredentials): ClassroomCredentials {
  if (
    !value ||
    !Number.isSafeInteger(value.appId) ||
    value.appId <= 0 ||
    ![value.roomId, value.userId, value.streamId, value.token].every(
      (field) => typeof field === 'string' && field.trim().length > 0,
    ) ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0 ||
    value.role !== 'TEACHER'
  )
    throw new Error('课堂入房凭证无效，请检查后端 ZEGO 配置。')
  if (value.screenStreamId != null && value.screenStreamId !== `${value.streamId}_screen`)
    throw new Error('课堂屏幕共享凭证无效。')
  return value
}

/** 始终走真实后端；入房与续期共用此接口。 */
export async function joinVideoClassroom(
  bookingId: number | string,
): Promise<ClassroomCredentials> {
  requireBookingId(bookingId)
  const response = await backendHttp.post<{ data: ClassroomCredentials }>(
    `/zego/bookings/${bookingId}/join`,
    undefined,
    { headers: { 'X-Active-Role': 'teacher' } },
  )
  return validateCredentials(response.data.data)
}

export async function closeVideoClassroom(bookingId: number | string): Promise<void> {
  requireBookingId(bookingId)
  await backendHttp.post(`/zego/bookings/${bookingId}/close`, undefined, {
    headers: { 'X-Active-Role': 'teacher' },
  })
}

/** 不上传浏览器时间；由后端闭合当前教师会话并汇总真实回调记录。 */
export async function leaveVideoClassroom(
  bookingId: number | string,
  token = sessionToken.value,
): Promise<ClassroomAttendance> {
  requireBookingId(bookingId)
  if (!token || token !== sessionToken.value)
    throw new Error('登录会话已变更，无法提交原课堂离课记录。')
  const { data } = await backendHttp.post<{ data: ClassroomAttendance }>(
    `/zego/bookings/${bookingId}/leave`,
    undefined,
    { headers: { satoken: token, 'X-Active-Role': 'teacher' } },
  )
  const result = data.data
  if (!result) throw new Error('教师离课响应不完整。')
  requireBookingId(result.bookingId)
  if (
    String(result.bookingId) !== String(bookingId) ||
    result.role !== 'TEACHER' ||
    typeof result.userId !== 'string' ||
    !result.userId.trim() ||
    ![0, 1].includes(result.attendanceFlag) ||
    !Number.isSafeInteger(result.attendanceSeconds) ||
    result.attendanceSeconds < 0
  ) {
    throw new Error('教师离课记录无效，请重试。')
  }
  for (const value of [result.firstInTime, result.lastOutTime]) {
    if (value != null && !normalizeTeacherTime(value)) throw new Error('教师离课时间格式不正确。')
  }
  return {
    ...result,
    bookingId: String(result.bookingId),
    firstInTime: result.firstInTime ?? null,
    lastOutTime: result.lastOutTime ?? null,
  }
}
