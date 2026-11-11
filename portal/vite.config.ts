import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El portal es una app aparte de la landing: se despliega en Vercel
// (portal.blink.com.ve) y la landing sigue intacta en GitHub Pages.
// Los tokens y la tipografía se importan del repo principal por alias;
// no se duplica el sistema de diseño.
export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@tokens": fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)),
      "@fonts": fileURLToPath(new URL("../src/styles/fonts.css", import.meta.url)),
    },
  },
  server: {
    port: 5177,
    // Vite sirve los tokens y las fuentes que viven fuera de `portal/`.
    fs: { allow: [".."] },
  },
  preview: { port: 4177 },
  build: {
    target: "es2022",
    cssTarget: ["chrome123", "safari17.5", "firefox120", "edge123"],
  },
});
