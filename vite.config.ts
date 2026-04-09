import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/three/examples/')) {
            return 'three-examples'
          }

          if (id.includes('/three/')) {
            return 'three-core'
          }

          if (id.includes('/@pixiv/three-vrm-animation/')) {
            return 'vrm-animation'
          }

          if (id.includes('/@pixiv/three-vrm-materials-mtoon/')) {
            return 'vrm-mtoon'
          }

          if (id.includes('/@pixiv/three-vrm/')) {
            return 'vrm-core'
          }

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
