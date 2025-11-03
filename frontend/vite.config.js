import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Permite acceso desde cualquier host
    allowedHosts: [
      'auckland-antarctica-lions-memorial.trycloudflare.com',
      '.trycloudflare.com' // Permite cualquier subdominio de trycloudflare.com
    ]
  }
})
