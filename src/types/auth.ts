export type LoginType = 'PASSWORD' | 'CODE'

export type LoginIdentity = { phone: string } & (
  { loginType: 'PASSWORD'; password: string } | { loginType: 'CODE'; smsCode: string }
)

export interface SmsCodeResponse {
  expireSeconds: number
  resendAfterSeconds: number
}

export interface AuthUser {
  userId: number | string
  userName: string
  loginAccount?: string
  phone?: string
  roles: { code: string; name: string }[]
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface ApiResult<T> {
  code: number
  msg: string
  data: T
}
