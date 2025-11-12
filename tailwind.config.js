// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/index.html',
    './frontend/src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'stem-blue': '#002D6E',
        'stem-navy': '#0f172a',
        'stem-orange': '#f97316',
        'stem-light': '#e2e8f0'
      },
    },
  },
  plugins: [],
}