/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wire: {
          off: '#94a3b8',
          low: '#facc15',
          mid: '#f97316',
          high: '#ef4444',
        },
        panel: {
          bg: '#ffffff',
          border: '#e2e8f0',
          hover: '#f1f5f9',
        },
      },
    },
  },
  plugins: [],
};
