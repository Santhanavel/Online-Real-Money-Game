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
        // Lobby Design System (Deep Burgundy & Red RummyCulture Palette)
        rc: {
          bg: '#650D16',
          bgDeep: '#37070D',
          redSec: '#8D1420',
          redHigh: '#B92730',
          gold: '#F6BE36',
          goldHigh: '#FFD96A',
          greenAction: '#159A43',
          greenActionHover: '#118237',
          surface: '#FFFFFF',
          textMain: '#FFFFFF',
          textDark: '#262020',
          redBorder: '#961E28',
        },
        // Gameplay Design System (Dark Header & Green Oval Playing Table)
        game: {
          header: '#111414',
          bgSec: '#171B1B',
          tableFelt: '#087B3B',
          tableCenter: '#075C30',
          tableEdge: '#1B2821',
          cardBg: '#FFFFFF',
          cardText: '#171717',
          suitRed: '#E5232A',
          suitBlack: '#151515',
          timerActive: '#26D84C',
          playerInactive: '#A4AAA7',
        },
      },
    },
  },
  plugins: [],
};
