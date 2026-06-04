import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05080a",
          900: "#090d10",
          850: "#0d1317",
          800: "#11181d",
          700: "#1a252c",
        },
        market: {
          teal: "#18d4c0",
          amber: "#f7a81b",
          red: "#ff4d57",
          blue: "#5b7cfa",
          green: "#42d77d",
        },
      },
      boxShadow: {
        panel: "0 12px 40px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
