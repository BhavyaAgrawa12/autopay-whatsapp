/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          900: '#14532d',
        },
        whatsapp: {
          teal: '#075e54',
          green: '#25d366',
          dark: '#128c7e',
          light: '#dcf8c6',
        }
      }
    },
  },
  plugins: [],
}
