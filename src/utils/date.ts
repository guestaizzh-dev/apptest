/** 按日期中午构建对象，避免直接解析 YYYY-MM-DD 时受到 UTC 时区转换影响。 */
export function dateObject(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

export function formatDate(date: string): string {
  const value = dateObject(date)
  return `${value.getMonth() + 1}月${value.getDate()}日`
}

export function dayName(date: string): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[dateObject(date).getDay()] ?? ''
}

export function addDays(date: string, days: number): string {
  const value = dateObject(date)
  value.setDate(value.getDate() + days)

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 所有周视图统一从周一开始，跨月时仍返回完整七天。 */
export function weekDates(date: string): string[] {
  const mondayOffset = (dateObject(date).getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, index) => addDays(date, index - mondayOffset))
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/** 历史记录默认查看上月月初至今天，保留当前演示的查询范围。 */
export function previousMonthStart(date: string): string {
  const value = dateObject(date)
  value.setDate(1)
  value.setMonth(value.getMonth() - 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`
}

export function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const remainingMinutes = String(minutes % 60).padStart(2, '0')
  return `${hours}:${remainingMinutes}`
}
