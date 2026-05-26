import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@context': path.resolve(__dirname, './src/context'),
      '@services': path.resolve(__dirname, './src/services'),
      '@agents': path.resolve(__dirname, './src/agents'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
      // Shared addon descriptors — the JSON files in
      // aspect-agent-server/builder/addons/ are imported by both the
      // server (via require) and the client (via this alias). Single
      // source of truth for default lane / context / outputType /
      // promptTemplate / config across the React UI, the runtime,
      // and Alfred's patch generator.
      '@addons': path.resolve(__dirname, '../aspect-agent-server/builder/addons'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Allow imports from the workspace parent so `@addons/...` resolves
    // into the sibling `aspect-agent-server/` package. Vite's default
    // is restricted to the project root.
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
