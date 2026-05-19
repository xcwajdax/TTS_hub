/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1115",
        panel: "#171a21",
        panel2: "#1f232c",
        border: "#2a2f3a",
        accent: "#7c5cff",
        accent2: "#22d3ee",
        muted: "#8a93a6",
      },
    },
  },
  plugins: [],
};
