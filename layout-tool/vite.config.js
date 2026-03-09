import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/layout/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@heater_svgs': path.resolve(__dirname, 'heater_svgs'),
    },
  },
})
