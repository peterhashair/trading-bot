/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      // Optional: run without a visible window
      instances: [
        {
          browser: 'chromium',
          headless: true
        },
      ],
    },
    globals: true,
    setupFiles: './test/setup.ts',
  },
})
