interface MarcaProps {
  compacta?: boolean;
}

export function Marca({ compacta = false }: MarcaProps) {
  return (
    <a className={`marca ${compacta ? "marca--compacta" : ""}`} href="#/" aria-label="Ruta, ir al inicio">
      <svg className="marca__icono" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="14" fill="var(--accion)" />
        <path d="M14 35V13h11.4c6.2 0 9.8 3 9.8 7.9 0 3.3-1.8 5.8-4.8 7l5.2 7.1h-7.4l-5.5-7.1h-2.3V35H14Zm6.4-12.1h4.6c2.4 0 3.7-.9 3.7-2.6s-1.3-2.5-3.7-2.5h-4.6v5.1Z" fill="var(--accion-texto)" />
        <circle cx="37" cy="11" r="3" fill="var(--superficie)" />
      </svg>
      <span className="marca__texto">
        <strong>Ruta</strong>
        <span>Powered by Blink</span>
      </span>
    </a>
  );
}
