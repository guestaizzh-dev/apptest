import type { ApplicationRouteDefinition } from './types'

/**
 * 当前使用本地教师路由配置。
 * 后续登录接口返回路由数据后，替换这一数据来源即可复用注册及导航生成逻辑。
 */
export const teacherRoutes: ApplicationRouteDefinition[] = [
  {
    name: 'home',
    path: '/',
    component: 'HomeView',
    meta: { title: '首页', icon: 'home', order: 1, menu: true },
  },
  {
    name: 'schedule',
    path: '/schedule',
    component: 'ScheduleView',
    meta: { title: '课表', icon: 'calendar', order: 2, menu: true },
  },
  {
    name: 'profile',
    path: '/profile',
    component: 'ProfileView',
    meta: { title: '我的', icon: 'user', order: 3, menu: true },
  },
  {
    name: 'classroom',
    path: '/classroom/:id',
    component: 'ClassroomView',
    meta: { title: '在线课堂', fullscreen: true },
  },
]
