/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#071426', // Primary background
          900: '#0B1B32',
          800: '#10243D', // Secondary navy
          700: '#1A3353',
          600: '#28476E',
          500: '#3B6294',
        },
        orange: {
          DEFAULT: '#FF8A00', // Primary accent
          500: '#FF8A00',
          400: '#FF9D2E',     // Hover accent
          600: '#E67600',
          700: '#CC6400',
          100: '#FFF1E0',
          50: '#FFF8F0',
        },
        muted: '#A9B7C9',
        surface: '#F8FAFC',
        brand: {
          navy: '#071426',
          secondary: '#10243D',
          orange: '#FF8A00',
          hover: '#FF9D2E',
          light: '#F8FAFC',
          muted: '#A9B7C9',
        }
      },
      boxShadow: {
        'glow-orange': '0 0 25px -4px rgba(255, 138, 0, 0.35)',
        'glow-orange-lg': '0 0 40px -4px rgba(255, 138, 0, 0.45)',
        'premium': '0 20px 40px -15px rgba(7, 20, 38, 0.08)',
        'premium-dark': '0 20px 40px -15px rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
