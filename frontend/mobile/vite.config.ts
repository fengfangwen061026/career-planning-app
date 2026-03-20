import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5176,
    proxy: {
      '/api/students/[^/]+/upload-resume/stream': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        selfHandleResponse: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no'
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  }
})
