/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#151914', paper: '#f6f5ef', lime: '#d7f36a', muted: '#74796f' }, fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] } } },
  plugins: []
}