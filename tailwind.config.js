/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#171717', paper: '#F3F0E8', ember: '#E8753D', steel: '#414141', muted: '#6F6B65' }, fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] } } },
  plugins: []
}