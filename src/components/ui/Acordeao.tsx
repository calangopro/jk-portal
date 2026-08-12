import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Acordeão em `<details>` nativo.
 *
 * Sem JavaScript: teclado, leitor de tela e a busca do navegador (Ctrl+F, que
 * abre o item fechado) funcionam de graça. A animação de altura sai do CSS,
 * pelo truque de grid 0fr para 1fr em `.acordeao-corpo`.
 */
export function Acordeao({
  titulo,
  children,
  aberto = false,
  nome,
  className = "",
}: {
  titulo: ReactNode;
  children: ReactNode;
  aberto?: boolean;
  /** Mesmo `nome` em vários itens faz o grupo abrir um de cada vez. */
  nome?: string;
  className?: string;
}) {
  return (
    <details
      open={aberto}
      name={nome}
      className={`acordeao glass-sutil group rounded-lg ${className}`}
    >
      <summary className="flex items-start justify-between gap-4 px-5 py-4 text-left">
        <span className="font-semibold text-ink">{titulo}</span>
        <ChevronDown
          size={18}
          aria-hidden
          className="mt-0.5 shrink-0 text-brand-nav transition-transform duration-300 group-open:rotate-180"
        />
      </summary>
      <div className="acordeao-corpo">
        <div>
          <div className="px-5 pb-5 text-apoio text-muted">{children}</div>
        </div>
      </div>
    </details>
  );
}
