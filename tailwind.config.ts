import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        rojRed: { DEFAULT: "#E5472F", hover: "#CC3D29", light: "#FCE9E5" },
        rojNavy: { DEFAULT: "#152538", muted: "#34465A", light: "#526477" },
        rojWarmBg: "#F7F5F1",
      },
      borderRadius: { roj: "16px" }
    },
  },
  plugins: [],
};
export default config;
