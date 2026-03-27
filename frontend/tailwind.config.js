/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        or: {
          bg: "#f4f5fb",
          cream: "#ffffff",
          ink: "#0f172a",
          muted: "#64748b",
          amber: "#4f46e5",
          sage: "#10b981",
        },
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        "or-card":
          "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 4px 12px rgb(79 70 229 / 0.06)",
        "or-lift":
          "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 8px 24px rgb(79 70 229 / 0.08)",
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
