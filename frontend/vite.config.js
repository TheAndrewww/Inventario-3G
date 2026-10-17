import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Las TV y tabletas de la planta traen navegadores viejos: al minificar, el CSS no se vuelve a juntar en
    // formas que no conocen (por ejemplo `inset`, que deja la pantalla de TV en negro). Ver postcss.config.js.
    cssTarget: ['chrome64', 'safari12', 'firefox67', 'edge79'],
  },
  server: {
    host: true, // Permite acceso desde cualquier host
    allowedHosts: [
      'auckland-antarctica-lions-memorial.trycloudflare.com',
      '.trycloudflare.com' // Permite cualquier subdominio de trycloudflare.com
    ]
  }
})
