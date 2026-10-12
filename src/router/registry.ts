import { ref, type Component } from 'vue'
import type { Router, RouteRecordRaw } from 'vue-router'
import type { ApplicationRouteDefinition, NavigationItem } from './types'

// Vite 编译时建立白名单，动态路由只能引用项目内已存在的页面。
const viewModules = import.meta.glob<{ default: Component }>('../views/*.vue')
const RESERVED_ROUTE_NAMES = new Set(['login', 'not-found', 'fallback'])

export function createRouteRegistry(router: Router) {
  let removeRegisteredRoutes: (() => void)[] = []
  const revision = ref(0)

  function replaceApplicationRoutes(definitions: ApplicationRouteDefinition[]): void {
    const names = new Set<string>()

    // 先验证整批数据，再移除旧路由；错误配置不会破坏当前可用的导航。
    const records: RouteRecordRaw[] = definitions.map((definition) => {
      if (
        !definition.name ||
        RESERVED_ROUTE_NAMES.has(definition.name) ||
        names.has(definition.name)
      ) {
        throw new Error(`路由名称无效或重复：${definition.name}`)
      }
      if (!definition.path.startsWith('/'))
        throw new Error(`路由路径必须以 / 开头：${definition.path}`)
      if (definition.path === '/login') throw new Error('业务路由不能覆盖登录入口')
      names.add(definition.name)

      const component = viewModules[`../views/${definition.component}.vue`]
      if (!component) throw new Error(`路由页面未在白名单中：${definition.component}`)
      return { name: definition.name, path: definition.path, component, meta: definition.meta }
    })

    clearApplicationRoutes()
    removeRegisteredRoutes = records.map((record) => router.addRoute(record))
    revision.value++
  }

  /** 登录身份变更时可清理业务路由，404 等基础路由不受影响。 */
  function clearApplicationRoutes(): void {
    removeRegisteredRoutes.forEach((remove) => remove())
    removeRegisteredRoutes = []
    revision.value++
  }

  return { replaceApplicationRoutes, clearApplicationRoutes, revision }
}

/** 菜单由路由元信息生成，增加或移除业务路由后不需要修改 App.vue。 */
export function getNavigationItems(router: Router): NavigationItem[] {
  return router
    .getRoutes()
    .filter((route) => route.meta.menu && typeof route.name === 'string')
    .map((route) => ({
      name: String(route.name),
      path: route.path,
      title: route.meta.title ?? '',
      icon: route.meta.icon ?? 'calendar',
      order: route.meta.order ?? 0,
    }))
    .sort((first, second) => first.order - second.order)
}
