import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
const frontendRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@testing-library/react', replacement: path.join(frontendRoot, 'node_modules/@testing-library/react') },
      { find: /^react$/, replacement: path.join(frontendRoot, 'node_modules/react') },
      { find: /^react\/(.*)$/, replacement: path.join(frontendRoot, 'node_modules/react/$1') },
    ],
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    include: ['../test/frontend/**/*.{test,spec}.{ts,tsx}'],
  },
})
