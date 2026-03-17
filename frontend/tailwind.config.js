/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        'primary-light': '#EEF2FF',
        'primary-dark': '#1D4ED8',
        'blue-fill': '#1D4ED8',
        'blue-mid': '#3B82F6',
        'blue-light': '#60A5FA',
        'blue-bg': '#EFF6FF',
        'amber-fill': '#D97706',
        'green-fill': '#10B981',
        'ds-900': '#0A0A0A',
        'ds-700': '#374151',
        'ds-500': '#6B7280',
        'ds-400': '#9CA3AF',
        'ds-200': '#E5E7EB',
      },
      borderRadius: {
        'ds': '16px',
        'ds-sm': '8px',
        'ds-md': '12px',
      },
      fontFamily: {
        'system': ['-apple-system', 'PingFang SC', 'SF Pro Display', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
