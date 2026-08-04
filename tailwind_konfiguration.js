/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Zwingend erforderlich, damit der Klassen-Wechsel greift
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