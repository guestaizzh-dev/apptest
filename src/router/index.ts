import { createRouter, createWebHistory } from 'vue-router'
import { registerRouterGuards } from './guards'
import { createRouteRegistry } from './registry'
import { teacherRoutes } from './teacherRoutes'

/** 基础路由固定，业务路由通过注册器加入；当前没有假定尚未提供的菜单接口。 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录', public: true, fullscreen: true },
    },
    {
      path: '/404',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
    { path: '/:pathMatch(.*)*', name: 'fallback', redirect: '/404' },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition ?? (to.name === from.name ? false : { top: 0 })
  },
})

export const routeRegistry = createRouteRegistry(router)
routeRegistry.replaceApplicationRoutes(teacherRoutes)
registerRouterGuards(router)

export default router
