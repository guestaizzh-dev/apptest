export interface ApplicationRouteDefinition {
  name: string
  path: string
  /** 使用前端页面标识，不接受后端直接提供的脚本 URL。 */
  component: string
  meta: {
    title: string
    icon?: string
    order?: number
    menu?: boolean
    fullscreen?: boolean
  }
}

export interface NavigationItem {
  name: string
  path: string
  title: string
  icon: string
  order: number
}

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    title?: string
    icon?: string
    order?: number
    menu?: boolean
    fullscreen?: boolean
  }
}
