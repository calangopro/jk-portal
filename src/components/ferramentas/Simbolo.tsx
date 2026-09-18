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
 *
 * REGRA APRENDIDA NO ERRO, em 18/09/2026: desenho abstrato também tem duplo
 * sentido, e o `REGRAS.md` proíbe duplo sentido. A primeira leva de emblemas
 * foi lida como pênis (o dedo de perfil em pé do simulador de largura), cacho
 * de uva (os três círculos em triângulo do comparador) e símbolo de gênero (os
 * dois aros com setas do conversor). Antes de aprovar emblema novo: olhe ele
 * GRANDE, olhe ele CORTADO e mostre para alguém sem dizer o que deveria ser.
 * Forma vertical alongada e agrupamento de três círculos são os dois arranjos
 * que mais escorregam.
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
    // Dois aros CONCÊNTRICOS e a cota do diâmetro entre eles: a mesma peça em
    // duas escalas. A versão anterior eram dois aros lado a lado com setas
    // saindo para fora, e aquilo lia como símbolo de gênero.
    return (
      <svg {...comum}>
        <circle cx="24" cy="24" r="16.5" />
        <circle cx="24" cy="24" r="9.5" strokeOpacity="0.55" />
        <path d="M15.5 24h17" strokeOpacity="0.85" />
        <path d="M18 21.6 15.4 24 18 26.4" strokeOpacity="0.85" />
        <path d="M30 21.6 32.6 24 30 26.4" strokeOpacity="0.85" />
      </svg>
    );
  }

  if (chave === "largura-da-alianca") {
    // A faixa da aliança DEITADA, com a cota da largura ao lado. Antes era um
    // dedo de perfil em pé, forma que, ampliada, lia como outra coisa. Deitada
    // ela só pode ser uma faixa, e a cota diz que o assunto é a medida dela.
    return (
      <svg {...comum}>
        <rect x="7" y="17" width="26" height="14" rx="3.5" />
        <path d="M39 17v14" strokeOpacity="0.75" />
        <path d="M36.8 19.2 39 17l2.2 2.2" strokeOpacity="0.75" />
        <path d="M36.8 28.8 39 31l2.2-2.2" strokeOpacity="0.75" />
      </svg>
    );
  }

  if (chave === "materiais-de-alianca") {
    // DOIS aros sobrepostos, um deles em traço partido: dois metais comparados.
    // Eram três em triângulo, arranjo que lia como cacho de uva. Dois lado a
    // lado é a figura clássica de comparação e não vira outra coisa.
    return (
      <svg {...comum}>
        <circle cx="19" cy="24" r="11.5" />
        <circle cx="29" cy="24" r="11.5" strokeOpacity="0.6" strokeDasharray="3 3.2" />
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
