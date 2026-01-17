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
        // Luxury Ibiza-Inspired Palette 🌴✨
        primary: {
          50: '#f8f9fa',
          100: '#f0f1f3',
          200: '#e0e3e8',
          300: '#c8cdd5',
          400: '#a8b0bd',
          500: '#7a8694', // Sophisticated slate
          600: '#5d6978',
          700: '#495361',
          800: '#2c3540', // Deep navy-charcoal
          900: '#1a1f27', // Darkest navy
        },
        accent: {
          50: '#fef7f3',
          100: '#fdeee6',
          200: '#fbdccd',
          300: '#f8c3a8',
          400: '#f4a67d',
          500: '#e8926f', // Warm terracotta
          600: '#d17556',
          700: '#b35e44',
          800: '#8f4a36',
          900: '#6d3729',
        },
        luxury: {
          50: '#fef9f5',
          100: '#fdf2ea',
          200: '#fae4d4',
          300: '#f7d0b5',
          400: '#f2b88c',
          500: '#d4a574', // Champagne gold
          600: '#b8885d',
          700: '#9a6e48',
          800: '#7a5638',
          900: '#5c3f28',
        },
        rosegold: {
          50: '#fef6f6',
          100: '#fdecec',
          200: '#fbd8d9',
          300: '#f7b8bb',
          400: '#f18f95',
          500: '#e76b73', // Rose gold accent
          600: '#d8505a',
          700: '#b93e47',
          800: '#96323a',
          900: '#732730',
        },
        success: {
          50: '#f0f7f4',
          100: '#d9ede3',
          200: '#b3dcc7',
          300: '#85c5a4',
          400: '#5aac81',
          500: '#3d8f66', // Sophisticated sage
          600: '#2f7150',
          700: '#265a40',
          800: '#1e4532',
          900: '#163326',
        },
        warning: {
          50: '#fef8f0',
          100: '#fdefd9',
          200: '#fbdfb3',
          300: '#f8ca85',
          400: '#f4b158',
          500: '#e69a3f', // Warm amber
          600: '#c87f2f',
          700: '#a56526',
          800: '#824e1f',
          900: '#623b18',
        },
        info: {
          50: '#f0f6fb',
          100: '#d9e8f5',
          200: '#b3d1eb',
          300: '#85b4dd',
          400: '#5a94cc',
          500: '#4178b0', // Mediterranean blue
          600: '#315f8f',
          700: '#284b71',
          800: '#1f3a57',
          900: '#172b42',
        },
        muted: '#7a8694',
        background: '#fdfcfb', // Softest warm cream
        card: '#ffffff',
        softcream: '#faf8f5', // Ultra-soft cream for sections
        warmwhite: '#fffefb', // Warm white for cards
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
