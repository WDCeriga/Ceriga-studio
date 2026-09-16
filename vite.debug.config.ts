import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal debug config: only the React plugin, no custom plugins.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
