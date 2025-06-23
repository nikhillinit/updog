import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['.replit.dev', '.repl.co', 'localhost'], // Add this line
    hmr: {
      clientPort: 443,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          utils: ['lucide-react', 'clsx', 'decimal.js']
        }
      }
    }
  },
  base: './',
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts', 'decimal.js']
  }
})
