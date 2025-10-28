/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        red: {
          700: '#B91C1C',
          800: '#991B1B',
        }
      }
    },
  },
  plugins: [],
}
