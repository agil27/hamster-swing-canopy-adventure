/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', '"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
        body: ['"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        canopy: {
          50: '#f3fbef',
          100: '#dff4d8',
          300: '#9bd88a',
          500: '#4fa85c',
          700: '#2c6b3c',
          900: '#16361f',
        },
        bark: '#5b3a24',
        honey: '#ffd166',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.7) translateY(14px)', opacity: '0' },
          '60%': { transform: 'scale(1.06) translateY(-4px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'heart-beat': {
          '0%, 100%': { transform: 'scale(1)' },
          '38%': { transform: 'scale(1.16)' },
          '54%': { transform: 'scale(1.02)' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-160% 0' },
          '100%': { backgroundPosition: '260% 0' },
        },
        'badge-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,214,102,0.55)' },
          '50%': { boxShadow: '0 0 22px 6px rgba(255,214,102,0.35)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 420ms cubic-bezier(.22,1.3,.36,1) both',
        'heart-beat': 'heart-beat 1.15s ease-in-out infinite',
        'float-soft': 'float-soft 3.4s ease-in-out infinite',
        shimmer: 'shimmer 2.6s linear infinite',
        'badge-glow': 'badge-glow 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
