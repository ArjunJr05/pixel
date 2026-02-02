import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    host: true, // Listen on all addresses
    allowedHosts: [
      'nonchivalrous-paranoidly-cara.ngrok-free.dev',
      '.ngrok-free.dev', // Allow all ngrok free domains
      '.ngrok.io', // Allow all ngrok.io domains
      'localhost',
    ],
  },
})
