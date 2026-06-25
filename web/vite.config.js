import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' => percorsi relativi, funziona su GitHub Pages (project site) e in locale
export default defineConfig({
  plugins: [react()],
  base: './',
})
