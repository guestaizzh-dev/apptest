import '@/styles/index.less'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'

const app = createApp(App)

// 守卫与组件共享 Pinia；先安装状态容器，再启动路由。
app.use(pinia)
app.use(router)
app.mount('#app')
