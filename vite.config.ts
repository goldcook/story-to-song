import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative assets work both at localhost and under /<repo>/ on GitHub Pages.
  base: './',
  plugins: [react()],
})
