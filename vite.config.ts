import path from 'node:path'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
})
