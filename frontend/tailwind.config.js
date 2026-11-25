/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff8ff",
          100: "#dceeff",
          200: "#b9e0ff",
          300: "#82caff",
          400: "#45adf5",
          500: "#2388e8",
          600: "#126bc7",
          700: "#1256a2",
          800: "#164a83",
          900: "#183f6d"
        }
      },
      boxShadow: {
        soft: "0 8px 30px rgba(30, 80, 130, 0.06)"
      }
    }
  },
  plugins: []
};
