import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      vueJsx(),
      vueDevTools(),
      {
        name: 'isolate-verification-cache',
        apply: 'serve',
        config(config) {
          if (!config.server?.middlewareMode) return
          // SSR 验证无需预打包浏览器依赖，也不能清理正在运行的开发服务缓存。
          return {
            cacheDir: 'node_modules/.vite-verification',
            optimizeDeps: { noDiscovery: true },
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      watch: { ignored: ['**/release/**'] },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8111',
          changeOrigin: true,
        },
      },
    },
  }
})
