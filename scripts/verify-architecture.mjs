import assert from 'node:assert/strict'
import { createServer } from 'vite'

import { createMemoryHistory, createRouter } from 'vue-router'

// Vite 负责解析 TS 和 @ 别名，不为这些契约检查额外引入测试框架。
const server = await createServer({ server: { middlewareMode: true, hmr: false } })

try {
  const { createRouteRegistry, getNavigationItems } =
    await server.ssrLoadModule('/src/router/registry.ts')
  const { teacherRoutes } = await server.ssrLoadModule('/src/router/teacherRoutes.ts')
  const { weekDates } = await server.ssrLoadModule('/src/utils/date.ts')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ name: 'not-found', path: '/404', component: { template: '<div />' } }],
  })
  const registry = createRouteRegistry(router)
  registry.replaceApplicationRoutes(teacherRoutes)
  assert.deepEqual(
    getNavigationItems(router).map((item) => item.name),
    ['home', 'schedule', 'profile'],
  )
  assert.throws(
    () =>
      registry.replaceApplicationRoutes([
        {
          name: 'invalid',
          path: '/invalid',
          component: 'UnknownView',
          meta: { title: '无效页面' },
        },
      ]),
    /白名单/,
  )
  assert.equal(router.hasRoute('schedule'), true, '无效动态路由不能破坏现有路由')
  registry.clearApplicationRoutes()
  assert.equal(router.hasRoute('schedule'), false)
  assert.equal(router.hasRoute('not-found'), true)
  registry.replaceApplicationRoutes(teacherRoutes)
  assert.equal(router.hasRoute('classroom'), true)

  assert.deepEqual(weekDates('2026-10-01'), [
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
  ])
  console.log('通过：路由白名单、动态替换与清理、跨月周日期。')
} finally {
  await server.close()
}
