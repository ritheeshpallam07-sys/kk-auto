/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#F59E0B',
          amber: '#D97706',
          dark: '#0F172A',
          green: '#047857',
          light: '#FFFBEB'
        }
      }
    },
  },
  plugins: [],
}
