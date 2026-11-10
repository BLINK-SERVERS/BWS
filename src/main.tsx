import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./pages/Landing";

/* ============================================================
   Punto de entrada de bws.blink.com.ve
   ------------------------------------------------------------
   El orden de las hojas NO es cosmético:
     fonts  -> declara las familias (SF Pro: `local()` primero y el
               recorte del repo detrás; Inter como respaldo servido)
     base   -> reset, iconos y utilidades
     tokens -> la escala de iOS 27 y las dos apariencias
     landing-> los temas `--lp-*` por sección, que ganan por ir al final

   Una sola ruta: BWS es una página y no necesita router. Tampoco
   service worker ni manifest — es contenido informativo, y cachearlo
   en el dispositivo solo complicaría publicar un cambio de texto.
   ============================================================ */
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/tokens.css";
import "./styles/landing.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
