/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Zwingend erforderlich für manuellen Dark Mode Schalter
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}