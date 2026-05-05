import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // @xenova/transformers uses dynamic imports internally; pre-bundling it
    // causes resolution errors. Exclude it and let the browser handle it.
    exclude: ['@huggingface/transformers'],
  },
  server: {
    // onnxruntime-web (used by @xenova/transformers) needs SharedArrayBuffer
    // for WASM multi-threading. Browsers gate SharedArrayBuffer behind these
    // two cross-origin isolation headers.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
