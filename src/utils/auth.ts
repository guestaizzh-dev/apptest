/** 登录后仅返回站内业务页面，拒绝协议地址和登录页循环。 */
export function safeLoginRedirect(value: unknown): string {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value) || /[\\\s]/.test(value)) return '/'
  let path: string
  try {
    path = decodeURIComponent(value.split(/[?#]/)[0] || '/')
  } catch {
    return '/'
  }
  return path === '/' ||
    path === '/schedule' ||
    path === '/profile' ||
    /^\/classroom\/\d+$/.test(path)
    ? value
    : '/'
}
