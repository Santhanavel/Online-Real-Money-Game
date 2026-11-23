/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/card-assets/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        table: {
          felt: '#0a3d2e',
          feltDark: '#06281e',
          feltLight: '#0d4a38',
          border: '#145a44',
          rail: '#2e1c0c',
        },
        gold: {
          light: '#fde047',
          DEFAULT: '#f59e0b',
          dark: '#b45309',
          glow: 'rgba(245, 158, 11, 0.4)',
        },
      },
    },
  },
  plugins: [],
};
