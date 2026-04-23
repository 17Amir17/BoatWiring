/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wire: {
          off: '#3a3f47',
          low: '#facc15',
          mid: '#f97316',
          high: '#ef4444',
        },
        panel: {
          bg: '#0f1115',
          border: '#1f2530',
          hover: '#1a1e26',
        },
      },
    },
  },
  plugins: [],
};
