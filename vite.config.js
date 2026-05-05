import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // @xenova/transformers uses dynamic imports internally; pre-bundling it
    // causes resolution errors. Exclude it and let the browser handle it.
    exclude: ['@xenova/transformers'],
  },
})
