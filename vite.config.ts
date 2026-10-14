import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' 保证 GitHub Pages 项目子路径（user.github.io/repo/）下资源可加载
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          echarts: ['echarts'],
          three: ['three'],
          vendor: ['vue', 'vue-router']
        }
      }
    }
  }
})
