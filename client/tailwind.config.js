/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 10px #a855f7, 0 0 20px #a855f7',
      },
    },
  },
  plugins: [],
}

