import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@mediapipe/face_mesh', '@mediapipe/camera_utils']
  },
  build: {
    rollupOptions: {
      external: ['@mediapipe/face_mesh', '@mediapipe/camera_utils']
    }
  }
})
