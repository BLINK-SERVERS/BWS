import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El portal vive en bws.blink.com.ve bajo rutas reales (`/registro`,
// `/ingreso`, …) y sirve sus archivos desde `/portal/assets/`. La landing
// sigue en `/` y la publica GitHub Pages; Cloudflare solo intercepta las
// rutas del portal y `/api`. Los tokens y la tipografía viven en
// `portal/sistema/`, una copia sincronizada desde la landing con
// `npm run sistema`: el Worker solo sube esta carpeta y no puede leer
// `../src`.
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
    assetsDir: "portal/assets",
    target: "es2022",
    cssTarget: ["chrome123", "safari17.5", "firefox120", "edge123"],
  },
});
