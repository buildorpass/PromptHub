import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0c0c0c",
          surface: "#161616",
          elevated: "#1f1f1f",
          border: "#2a2a2a",
          "border-subtle": "#1e1e1e",
          primary: "#f97316",
          secondary: "#a78bfa",
          success: "#10b981",
          warning: "#fbbf24",
          error: "#f43f5e",
          "text-primary": "#fafafa",
          "text-secondary": "#a1a1aa",
          "text-muted": "#52525b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
