import { ref } from 'vue'
import { defineStore } from 'pinia'

/** 提示状态与课程状态独立，避免路由和请求工具依赖页面组件。 */
export const useUiStore = defineStore('ui', () => {
  const toast = ref('')
  const toastPosition = ref<'top' | 'bottom'>('bottom')
  let timer: ReturnType<typeof setTimeout> | undefined

  function notify(message: string, position: 'top' | 'bottom' = 'bottom'): void {
    toast.value = message
    toastPosition.value = position
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      toast.value = ''
    }, 3500)
  }

  return { toast, toastPosition, notify }
})
