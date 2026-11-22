/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0D11',
        surface: {
          DEFAULT: '#12161F',
          muted: '#181E2B',
          border: '#242D40',
          accent: '#1E2536',
        },
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
        },
        grok: {
          blue: '#1DA1F2',
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          amber: '#F59E0B',
          rose: '#F43F5E',
          emerald: '#10B981',
        }
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.25)',
        'glow-blue': '0 0 25px -5px rgba(29, 161, 242, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
