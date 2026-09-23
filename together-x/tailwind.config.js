/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5B5BF0",
          dark: "#3F3FCB",
        },
      },
    },
  },
  plugins: [],
};
