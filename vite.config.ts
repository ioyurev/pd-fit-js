import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import path from 'node:path'

export default defineConfig({
  plugins: [solid()],
  base: process.env.GITHUB_PAGES_BASE ?? '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
