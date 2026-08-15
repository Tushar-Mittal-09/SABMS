/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B2A55',
          deep: '#071D3A',
          blue: '#1769E0',
          lightBlue: '#EAF3FF',
          gold: '#D9A441',
          goldLight: '#FFF6DF',
          bg: '#F5F8FC',
          surface: '#FFFFFF',
          text: '#172033',
          muted: '#667085',
          border: '#D9E1EC',
          success: '#15803D',
          error: '#DC2626',
          warning: '#B45309',
        },
        dark: {
          bg: '#07111F',
          surface: '#0B1628',
          surface2: '#14243A',
          text: '#EAF2FF',
          muted: '#9AA9BD',
          border: '#253852',
          blue: '#4D8DFF',
          gold: '#E0B04F',
          success: '#3FB950',
          error: '#FF6B6B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(11, 42, 85, 0.06), 0 2px 6px -1px rgba(11, 42, 85, 0.03)',
        'card-dark':
          '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.2)',
        glow: '0 0 15px rgba(23, 105, 224, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'scale-up': 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shake: 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-3px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(3px, 0, 0)' },
        },
      },
    },
  },
  plugins: [],
};
