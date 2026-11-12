import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El portal es una app aparte de la landing: se publica como Worker de
// Cloudflare (portal.blink.com.ve) y la landing sigue intacta en GitHub
// Pages. Los tokens y la tipografía viven en `portal/sistema/`, una copia
// sincronizada desde la landing con `npm run sistema`: el Worker solo sube
// esta carpeta y no puede leer `../src`.
export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@tokens": fileURLToPath(new URL("./sistema/tokens.css", import.meta.url)),
      "@fonts": fileURLToPath(new URL("./sistema/fonts.css", import.meta.url)),
    },
  },
  server: {
    port: 5177,
  },
  preview: { port: 4177 },
  build: {
    target: "es2022",
    cssTarget: ["chrome123", "safari17.5", "firefox120", "edge123"],
  },
});
