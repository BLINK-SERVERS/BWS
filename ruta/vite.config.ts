import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/cars/",
  plugins: [react()],
  server: { port: 5177, host: "0.0.0.0" },
  preview: { port: 4177, host: "0.0.0.0" },
  build: {
    target: "es2022",
    cssTarget: ["chrome123", "safari17.5", "firefox120", "edge123"],
  },
});
