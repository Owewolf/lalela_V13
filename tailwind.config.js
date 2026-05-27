/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0f4e55',
        'primary-container': '#1a6870',
        secondary: '#d86f41',
        'secondary-container': '#e58b5f',
        'tertiary-fixed': '#d9a34a',
        surface: '#f6efe4',
        'on-surface': '#16363c',
        'surface-container': '#f0e6d9',
        'surface-container-low': '#faf6ef',
        outline: '#b8ab98',
        'outline-variant': '#d8c9b4',
        error: '#ba1a1a',
      },
    },
  },
  plugins: [],
};
