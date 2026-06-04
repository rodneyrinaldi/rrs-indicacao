import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "#dadce0",
        brand: "#1a73e8",
      },
    },
  },
  plugins: [],
};

export default config;
