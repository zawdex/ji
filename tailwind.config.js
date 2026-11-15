export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans Myanmar"', "system-ui", "sans-serif"], display: ["Sora", "sans-serif"] },
      keyframes: { up: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "none" } } },
      animation: { up: ".35s ease both up" },
    },
  },
};
