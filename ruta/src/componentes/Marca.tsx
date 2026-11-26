interface MarcaProps {
  compacta?: boolean;
}

export function Marca({ compacta = false }: MarcaProps) {
  return (
    <a className={`marca ${compacta ? "marca--compacta" : ""}`} href="#/" aria-label="Car Market, ir al inicio">
      <span className="marca__texto">
        <strong>car market</strong>
      </span>
    </a>
  );
}
