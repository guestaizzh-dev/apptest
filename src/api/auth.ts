import { backendHttp, RequestError } from '@/services/http'
import type {
  ApiResult,
  AuthUser,
  LoginIdentity,
  LoginResponse,
  SmsCodeResponse,
} from '@/types/auth'

function validateTeacher(user: AuthUser): AuthUser {
  if (
    !user ||
    typeof user.userName !== 'string' ||
    !user.userName.trim() ||
    !Array.isArray(user.roles)
  )
    throw new RequestError('账号信息不完整，请联系管理员。')
  if (!user.roles.some((role) => role?.code === 'teacher'))
    throw new RequestError('该账号未配置教师角色，请使用教师手机号登录。', 403)
  return user
}

export async function teacherLogin(identity: LoginIdentity): Promise<LoginResponse> {
  const { data } = await backendHttp.post<ApiResult<LoginResponse>>('/auth/teacher-login', {
    phone: identity.phone,
    loginType: identity.loginType,
    ...(identity.loginType === 'PASSWORD'
      ? { password: identity.password }
      : { smsCode: identity.smsCode }),
  })
  if (typeof data.data?.token !== 'string' || !data.data.token.trim()) {
    throw new RequestError('登录响应不完整，请联系管理员。')
  }
  validateTeacher(data.data.user)
  return data.data
}

export async function requestLoginSmsCode(phone: string): Promise<SmsCodeResponse> {
  const { data } = await backendHttp.post<ApiResult<SmsCodeResponse>>('/auth/sms-code', { phone })
  const result = data.data
  if (
    !result ||
    !Number.isSafeInteger(result.expireSeconds) ||
    result.expireSeconds <= 0 ||
    !Number.isSafeInteger(result.resendAfterSeconds) ||
    result.resendAfterSeconds < 0
  )
    throw new RequestError('验证码响应不完整，请稍后重试。')
  return result
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await backendHttp.get<ApiResult<AuthUser>>('/auth/me')
  return validateTeacher(data.data)
}

export async function logoutSession(): Promise<void> {
  await backendHttp.post('/auth/logout')
}
