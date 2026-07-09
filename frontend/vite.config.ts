import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': resolve(rootDir, 'src') },
    // @flowposltd/ui is linked in via a `file:` symlink into the sibling
    // flowpos-ui workspace. Without this, Vite resolves that package's own
    // `react` import against flowpos-ui/node_modules/react instead of this
    // project's copy — two distinct module instances (even at the same
    // version) break React's hook dispatcher ("Invalid hook call").
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
    strictPort: true,
    // ngrok tunnels this dev server for local FlowPOS marketplace testing
    // (Install/Uninstall/Webhook/Dashboard component URLs) — Vite's Host
    // header check otherwise blocks requests arriving via that hostname.
    allowedHosts: ['preamble-childcare-consonant.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Backend-only lifecycle routes (HMAC-signed, called directly by
      // FlowPOS — not under /api). Proxied here too so the single ngrok
      // tunnel used for the marketplace listing's Install/Uninstall/Webhook
      // URLs can reach the Go backend.
      '/install': { target: 'http://localhost:8080', changeOrigin: true },
      '/uninstall': { target: 'http://localhost:8080', changeOrigin: true },
      '/webhooks': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  preview: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
