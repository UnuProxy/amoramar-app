/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/back-office/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Ibiza Modern & Professional Neutral Palette 🏝️🏛️
        primary: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd', 
          600: '#6c757d',
          700: '#495057',
          800: '#2C3E50', // Deep Slate (Professional & Neutral)
          900: '#1A252F', // Charcoal
        },
        accent: {
          50: '#fbfaf7',
          100: '#f7f2ea',
          200: '#ece3d1',
          300: '#e0d1b5',
          400: '#d1b994',
          500: '#B89B72', // Warm Antique Sand/Gold (Gender-neutral luxury)
          600: '#a38761',
          700: '#897050',
          800: '#6f5a41',
          900: '#564633',
        },
        luxury: {
          stone: '#8E8D8A',
          sand: '#E6DED3',
          navy: '#1B262C', // Deep Mediterranean Navy
          ocean: '#4A6B6B', // Muted Sea Green/Blue
        },
        success: {
          500: '#5A7D6C', // Muted Sage
        },
        warning: {
          500: '#B88B4A', // Muted Ochre
        },
        info: {
          500: '#5B7A8C', // Steel Blue
        },
        background: '#F4F1EE', // Soft Stone/Alabaster
        card: '#FFFFFF',
        softcream: '#FAF9F6',
        warmwhite: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
