import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendOrigin = env.PLANGLADE_DEV_BACKEND_ORIGIN || 'http://127.0.0.1:3000'

  return {
    base: '/',
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendOrigin,
        },
      },
    },
    resolve: {
      alias: [
        {
          find: '@/data/seed',
          replacement: path.resolve(__dirname, mode === 'reference' ? './src/data/seed.ts' : './src/data/seed.api.ts'),
        },
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('/@radix-ui/') || id.includes('/cmdk/') || id.includes('/vaul/')) return 'ui-vendor'
            if (id.includes('/framer-motion/') || id.includes('/motion-') || id.includes('/@dnd-kit/')) return 'motion-vendor'
            if (id.includes('/@xyflow/') || id.includes('/d3-') || id.includes('/recharts/')) return 'visualization-vendor'
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router/') || id.includes('/@tanstack/')) return 'react-vendor'
            return undefined
          },
        },
      },
    },
  }
})
