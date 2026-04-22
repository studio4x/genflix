import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }

            if (id.includes('react-router')) {
              return 'vendor-router'
            }

            if (id.includes('@supabase/supabase-js') || id.includes('@supabase/auth-js')) {
              return 'vendor-supabase'
            }

            if (id.includes('@radix-ui/')) {
              return 'vendor-ui'
            }

            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }

            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query'
            }

            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('/zod/')) {
              return 'vendor-forms'
            }

            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }

            if (id.includes('pdf-lib') || id.includes('html2pdf.js')) {
              return 'vendor-pdf'
            }

            return 'vendor'
          }

          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
