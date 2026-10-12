import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { canEnter } from '@/utils/lesson'
import { minutesToTime, timeToMinutes } from '@/utils/date'
import { createTeachingSnapshot } from './teachingSeed'

/**
 * 通过 Axios adapter 模拟服务端，而不是让页面直接读取示例数组。
 * 关闭 VITE_USE_MOCK_API 后，同一组 API 方法将发起正常 HTTP 请求。
 */
export function createMockAdapter(): AxiosAdapter {
  const snapshot = createTeachingSnapshot()

  return async (config) => {
    await new Promise((resolve) => setTimeout(resolve, 80))
    if (config.signal?.aborted) throw new CanceledError('请求已取消。', config)

    const method = config.method?.toUpperCase() || 'GET'
    const path = config.url || ''

    if (method === 'GET' && path === '/teaching/overview') {
      return response(config, structuredClone(snapshot))
    }

    const match = path.match(/^\/teaching\/lessons\/(\d+)\/(join|finish)$/)
    if (method !== 'POST' || !match) {
      throw mockError(config, 404, '未定义该演示接口。')
    }

    const id = Number(match[1])
    const action = match[2]
    const lesson = snapshot.lessons.find((item) => item.id === id)
    if (!lesson) throw mockError(config, 404, '课程不存在。')
    if (!canEnter(lesson)) throw mockError(config, 409, '当前课程状态不允许进入或结束课堂。')

    if (action === 'join') {
      // 重复进入同一课堂仍保留同一个排课 ID，不创建重复记录。
      lesson.status = 'live'
    } else {
      if (lesson.status !== 'live') throw mockError(config, 409, '请先进入课堂。')

      // 示例时间模拟服务端结果；正式业务不能用客户端计时器计算最终课时。
      lesson.status = 'completed'
      lesson.actualStart = minutesToTime(timeToMinutes(lesson.start) + 2)
      lesson.actualEnd = lesson.end
      lesson.duration = timeToMinutes(lesson.end) - timeToMinutes(lesson.actualStart)
    }

    return response(config, structuredClone(lesson))
  }
}

function response<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config }
}

function mockError(
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
): AxiosError {
  const errorResponse: AxiosResponse = {
    data: { message },
    status,
    statusText: 'Mock request rejected',
    headers: new AxiosHeaders(),
    config,
  }
  return new AxiosError(message, 'ERR_BAD_RESPONSE', config, undefined, errorResponse)
}
