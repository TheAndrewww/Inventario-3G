/** @type {import('tailwindcss').Config} */
// Diseño 3G: agrega la variante g3: (solo con el interruptor encendido) y los colores g3-*. No cambia ninguna clase existente.
import g3 from './src/diseno-3g/puentes/tailwind-preset.cjs'

export default {
  presets: [g3],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-red': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        }
      }
    },
  },
  plugins: [],
}
