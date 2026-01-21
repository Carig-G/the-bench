/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The Bench - Warm, inviting color palette
        cream: {
          50: '#FDFCFA',
          100: '#FAF8F5',  // Primary background
          200: '#F5F2ED',  // Secondary background
          300: '#EBE6DD',
          400: '#E8DCC4',  // Borders/dividers
        },
        sage: {
          50: '#F2F5F2',
          100: '#E5EBE5',
          200: '#C9D9C8',
          300: '#A3C2A2',
          400: '#7D9D7C',  // Primary accent
          500: '#5F7F5E',
          600: '#4A6349',
          700: '#3A4F3A',
          800: '#2E3F2E',
          900: '#243024',
        },
        terracotta: {
          50: '#FDF6F4',
          100: '#FBEAE6',
          200: '#F5D0C7',
          300: '#E9AFA0',
          400: '#D4816F',  // CTA buttons
          500: '#C26B55',
          600: '#A85640',
          700: '#8A4534',
          800: '#70382B',
          900: '#5C2F24',
        },
        warmgray: {
          50: '#F9F9F8',
          100: '#EFEFED',
          200: '#DCDCD9',
          300: '#B8B8B4',
          400: '#8A8A86',
          500: '#6B6B68',  // Text secondary
          600: '#555553',
          700: '#3A3A38',  // Text primary
          800: '#2A2A28',
          900: '#1A1A18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
}
