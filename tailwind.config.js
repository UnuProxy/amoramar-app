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
        primary: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280', // muted text
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#1A1A1A', // primary dark
        },
        accent: {
          50: '#fff5f6',
          100: '#ffe4e7',
          200: '#fdc9cf',
          300: '#f99aa5',
          400: '#f26b7a',
          500: '#E63946', // primary accent
          600: '#c72f3b',
          700: '#a32631',
          800: '#7d1c26',
          900: '#5f151e',
        },
        success: {
          50: '#f1f8f5',
          100: '#d9f0e6',
          200: '#b2e1ce',
          300: '#82cda9',
          400: '#52b784',
          500: '#2D936C', // success/available
          600: '#237357',
          700: '#1d5c46',
          800: '#164535',
          900: '#0f2f25',
        },
        warning: {
          50: '#fff6ec',
          100: '#ffe8ce',
          200: '#fdd3a2',
          300: '#fbbb73',
          400: '#f7a54c',
          500: '#F4A261', // warning/pending
          600: '#d98242',
          700: '#b86433',
          800: '#914b29',
          900: '#6c371f',
        },
        info: {
          50: '#eef5ff',
          100: '#dbe9fe',
          200: '#b6d2fc',
          300: '#8bb8f8',
          400: '#5d99f2',
          500: '#3B82F6', // info/booked
          600: '#2964d8',
          700: '#1f4fb2',
          800: '#1d438c',
          900: '#1b3a70',
        },
        muted: '#6B7280',
        background: '#FAFAFA',
        card: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
