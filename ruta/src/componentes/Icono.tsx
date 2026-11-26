import type { SVGProps } from "react";

export type IconoNombre =
  | "inicio"
  | "buscar"
  | "filtro"
  | "guardar"
  | "corazon"
  | "chat"
  | "publicar"
  | "usuario"
  | "campana"
  | "cerrar"
  | "flecha-izquierda"
  | "flecha-derecha"
  | "chevron-abajo"
  | "chevron-derecha"
  | "compartir"
  | "ubicacion"
  | "calendario"
  | "gasolina"
  | "cambio"
  | "velocidad"
  | "escudo"
  | "verificado"
  | "camara"
  | "galeria"
  | "imagen"
  | "basura"
  | "agregar"
  | "sol"
  | "luna"
  | "monitor"
  | "ajustes"
  | "salir"
  | "bandera"
  | "bloquear"
  | "cierre"
  | "tarjeta"
  | "estrella"
  | "patrocinado"
  | "ranking"
  | "privacidad"
  | "moderacion"
  | "menu"
  | "check"
  | "enviar"
  | "expandir"
  | "info";

interface IconoProps extends SVGProps<SVGSVGElement> {
  nombre: IconoNombre;
  tamano?: number;
}

export function Icono({ nombre, tamano = 24, ...props }: IconoProps) {
  const contenido = (() => {
    switch (nombre) {
      case "inicio":
        return <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></>;
      case "buscar":
        return <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>;
      case "filtro":
        return <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>;
      case "guardar":
        return <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" />;
      case "corazon":
        return <path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z" />;
      case "chat":
        return <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z" /><path d="M7 9h10M7 13h6" /></>;
      case "publicar":
        return <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M5 13v7h14v-7" /></>;
      case "usuario":
        return <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>;
      case "campana":
        return <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>;
      case "cerrar":
        return <path d="m6 6 12 12M18 6 6 18" />;
      case "flecha-izquierda":
        return <path d="m14 5-7 7 7 7" />;
      case "flecha-derecha":
        return <path d="m10 5 7 7-7 7" />;
      case "chevron-abajo":
        return <path d="m6 9 6 6 6-6" />;
      case "chevron-derecha":
        return <path d="m9 6 6 6-6 6" />;
      case "compartir":
        return <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>;
      case "ubicacion":
        return <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>;
      case "calendario":
        return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M17 14h1M7 18h2M12 18h2" /></>;
      case "gasolina":
        return <><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M3 21h13M4 10h11M15 8h2l3 3v7a2 2 0 0 1-4 0v-4" /><path d="M7 6h5" /></>;
      case "cambio":
        return <><path d="M6 4v16M18 4v16M6 8h12M9 5l3-3 3 3M9 19l3 3 3-3M6 16h12" /></>;
      case "velocidad":
        return <><path d="M4.2 18a9 9 0 1 1 15.6 0" /><path d="m12 13 4-5M5 12h2M17 12h2M12 5v2" /><circle cx="12" cy="13" r="1.5" /></>;
      case "escudo":
        return <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />;
      case "verificado":
        return <><path d="m12 3 2.3 1.7 2.8-.2 1.1 2.6 2.3 1.7-.6 2.8.6 2.8-2.3 1.7-1.1 2.6-2.8-.2L12 21l-2.3-1.7-2.8.2-1.1-2.6-2.3-1.7.6-2.8-.6-2.8 2.3-1.7 1.1-2.6 2.8.2L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>;
      case "camara":
        return <><path d="M4 7h4l2-3h4l2 3h4v13H4V7Z" /><circle cx="12" cy="13" r="4" /></>;
      case "galeria":
        return <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>;
      case "imagen":
        return <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>;
      case "basura":
        return <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>;
      case "agregar":
        return <path d="M12 5v14M5 12h14" />;
      case "sol":
        return <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>;
      case "luna":
        return <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />;
      case "monitor":
        return <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>;
      case "ajustes":
        return <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 2h-5L9 6.1a7 7 0 0 0-1.7 1L5 6.1 3 9.5l2 1.5a7 7 0 0 0 0 2L3 14.5l2 3.4 2.3-1a7 7 0 0 0 1.7 1l.5 4.1h5l.5-4.1a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></>;
      case "salir":
        return <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>;
      case "bandera":
        return <><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></>;
      case "bloquear":
        return <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>;
      case "cierre":
        return <><path d="M8 4H4v16h16v-4M14 4h6v6M20 4l-9 9" /><path d="M13 14v6h6" /></>;
      case "tarjeta":
        return <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>;
      case "estrella":
        return <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />;
      case "patrocinado":
        return <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3V9ZM7 9v6" /></>;
      case "ranking":
        return <><path d="M5 20v-6M12 20V8M19 20V4" /><path d="M3 20h18" /></>;
      case "privacidad":
        return <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>;
      case "moderacion":
        return <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="M9 9h6M9 13h6" /></>;
      case "menu":
        return <path d="M4 7h16M4 12h16M4 17h16" />;
      case "check":
        return <path d="m5 12 4 4L19 6" />;
      case "enviar":
        return <><path d="m21 3-7 18-4-7-7-4 18-7Z" /><path d="M10 14 21 3" /></>;
      case "expandir":
        return <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></>;
      case "info":
        return <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>;
    }
  })();

  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {contenido}
    </svg>
  );
}
