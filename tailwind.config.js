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
        primary: '#0d3d47',
        'primary-container': '#1e5667',
        secondary: '#9c4421',
        'secondary-container': '#fc7127',
        'tertiary-fixed': '#ffddb9',
        surface: '#fff8f0',
        'on-surface': '#1a1c1a',
        'surface-container': '#efeeeb',
        'surface-container-low': '#f4f3f1',
        outline: '#737971',
        'outline-variant': '#c2c8bf',
        error: '#ba1a1a',
      },
    },
  },
  plugins: [],
};
