/**
 * Duas alianças entrelaçadas.
 *
 * Desenhado à mão porque o conjunto do lucide não tem aliança, e as
 * alternativas próximas (círculo, diamante, brilho) diziam outra coisa. Num
 * portal de joalheria, o ícone do medidor precisa ser a peça em si.
 *
 * Herda a cor por `currentColor` e a espessura de traço segue o manual da
 * marca (1,4 a 1,7px em 24px).
 */
export function IconeAlianca({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="14.5" r="6" />
      <circle cx="16" cy="12" r="6" />
      {/* Pedra da aliança de cima, o detalhe que faz ler como joia. */}
      <path d="M14.4 4.6 16 2.5l1.6 2.1L16 6.4z" />
    </svg>
  );
}
