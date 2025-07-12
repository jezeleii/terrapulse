/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        text:       "#d6faff",
        background: "#00181b",
        primary:    "#14fed6",
        secondary:  "#8bfdee",
        accent:     "#30ffa9",
      },
      height: {
        screen: ["100vh", "100dvh"],
      }
    },
  },
  plugins: [],
};
