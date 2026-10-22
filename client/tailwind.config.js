/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "!./src/flutter/**",
  ],
  theme: {
    extend: {
      colors: {
        // Premium Black and Lime Design System
        bg: {
          main: '#0B0B0D',
          card: '#171719',
          elevated: '#202023',
        },
        lime: {
          DEFAULT: '#C6FF3D',
          hover: '#B5F028',
          dim: 'rgba(198, 255, 61, 0.12)',
          dark: '#9ECE1E',
        },
        surface: {
          DEFAULT: '#171719',
          card: '#171719',
          elevated: '#202023',
          inset: '#111113',
        },
        border: {
          DEFAULT: '#303034',
          subtle: '#26262A',
          dark: '#303034',
          lime: '#C6FF3D',
        },
        brand: {
          lime: '#C6FF3D',
          'lime-hover': '#B5F028',
          'lime-dim': 'rgba(198, 255, 61, 0.12)',
          bg: '#0B0B0D',
          card: '#171719',
          elevated: '#202023',
          border: '#303034',
          text: '#FFFFFF',
          muted: '#A1A1AA',
        },
        // Backwards compatibility mappings for smooth transition
        dark: {
          DEFAULT: '#0B0B0D',
          900: '#0B0B0D',
          800: '#171719',
          700: '#202023',
          600: '#303034',
        },
        navy: {
          950: '#0B0B0D',
          900: '#171719',
          800: '#202023',
          700: '#303034',
          600: '#71717A',
          500: '#A1A1AA',
        },
        orange: {
          DEFAULT: '#C6FF3D',
          500: '#C6FF3D',
          400: '#D5FF66',
          600: '#B5F028',
          700: '#9ECE1E',
          100: '#F4FFE0',
          50: '#FAFFF0',
        },
        muted: '#A1A1AA',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgb(0 0 0 / 0.3)',
        'card': '0 4px 20px -2px rgb(0 0 0 / 0.4)',
        'elevated': '0 10px 30px -4px rgb(0 0 0 / 0.5)',
        'sheet': '0 -4px 25px -4px rgb(0 0 0 / 0.6)',
        'glow-lime': '0 0 25px -3px rgba(198, 255, 61, 0.35)',
        'glow-lime-sm': '0 0 15px -2px rgba(198, 255, 61, 0.25)',
        'glow-green': '0 0 25px -3px rgba(198, 255, 61, 0.35)',
        'glow-orange': '0 0 25px -3px rgba(198, 255, 61, 0.35)',
        'glow-orange-lg': '0 0 35px -4px rgba(198, 255, 61, 0.45)',
        'premium': '0 4px 20px -2px rgb(0 0 0 / 0.4)',
        'premium-dark': '0 10px 30px -4px rgb(0 0 0 / 0.6)',
      }
    },
  },
  plugins: [],
}
