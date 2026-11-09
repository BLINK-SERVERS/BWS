import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BWS se publica en la raíz de bws.blink.com.ve, así que `base` va en "/".
// Los puertos son distintos a los de Pay (5175) y POS para que las tres
// apps puedan convivir levantadas en la misma máquina.
export default defineConfig({
  base: "/",
  plugins: [react()],
  server: { port: 5176 },
  preview: { port: 4176 },
  build: {
    target: "es2022",
    cssTarget: ["chrome123", "safari17.5", "firefox120", "edge123"],
  },
});
