/**
 * Emblema de cada ferramenta, em traço.
 *
 * Ícone de biblioteca resolveria em cinco minutos e entregaria uma régua
 * genérica para uma ferramenta que mede aro. Aqui cada emblema desenha o que a
 * ferramenta faz: o furo do anel, a troca de escala, a faixa no dedo, os
 * metais. São traços em `currentColor`, então o mesmo desenho serve no menu
 * (16 px, dourado escuro) e no cartão da home (72 px, dourado claro sobre
 * carvão), sem arquivo novo e sem cor cravada.
 *
 * Sem estado e sem hook de propósito: assim o mesmo componente entra no
 * cabeçalho, que é cliente, e nas páginas, que são servidor.
 */
export function SimboloDaFerramenta({
  chave,
  className = "",
  strokeWidth = 1.4,
}: {
  chave: string;
  className?: string;
  strokeWidth?: number;
}) {
  const comum = {
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: `block ${className}`,
  };

  if (chave === "medidor") {
    // O furo, que é o que a ferramenta mede, com as marcas de centro.
    return (
      <svg {...comum}>
        <circle cx="24" cy="24" r="15.5" />
        <circle cx="24" cy="24" r="10" strokeOpacity="0.55" />
        <path d="M24 8.5v4M24 35.5v4M8.5 24h4M35.5 24h4" strokeOpacity="0.75" />
      </svg>
    );
  }

  if (chave === "conversor-de-aros") {
    // Dois aros de tamanhos diferentes e a troca entre eles.
    return (
      <svg {...comum}>
        <circle cx="13" cy="24" r="8.5" />
        <circle cx="35" cy="24" r="5.5" />
        <path d="M20 18.5h8.5M26.5 16.5l2.4 2-2.4 2" strokeOpacity="0.8" />
        <path d="M28.5 29.5H20M22.5 27.5l-2.4 2 2.4 2" strokeOpacity="0.8" />
      </svg>
    );
  }

  if (chave === "largura-da-alianca") {
    // O dedo de perfil com a faixa atravessada, e a cota da largura ao lado.
    return (
      <svg {...comum}>
        <path d="M17 41V17.5a6.5 6.5 0 0 1 13 0V41" />
        <path d="M15.5 26.5h16M15.5 33h16" />
        <path d="M38 26.5v6.5M36 28l2-1.6 2 1.6M36 31.5l2 1.6 2-1.6" strokeOpacity="0.7" />
      </svg>
    );
  }

  if (chave === "materiais-de-alianca") {
    // Três metais lado a lado, um deles em traço partido: teor diferente.
    return (
      <svg {...comum}>
        <circle cx="18" cy="19" r="9" />
        <circle cx="30" cy="19" r="9" strokeOpacity="0.6" strokeDasharray="3 3.2" />
        <circle cx="24" cy="31" r="9" strokeOpacity="0.85" />
      </svg>
    );
  }

  // Ferramenta nova sem emblema próprio: um aro liso, nunca um buraco no menu.
  return (
    <svg {...comum}>
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="8" strokeOpacity="0.5" />
    </svg>
  );
}
