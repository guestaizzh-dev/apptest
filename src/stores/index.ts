import { createPinia } from 'pinia'

/** 路由守卫在组件挂载前执行，因此与应用显式共享同一个 Pinia 实例。 */
export const pinia = createPinia()
