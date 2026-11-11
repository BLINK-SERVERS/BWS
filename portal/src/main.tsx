import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fonts";
import "@tokens";
import "./estilos/portal.css";
import { App } from "./App";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
