import Link from "next/link";
import type { ReactNode } from "react";

type Tom = "dourado" | "vinho" | "neutro" | "claro";

const tons: Record<Tom, string> = {
  dourado: "bg-brand/12 text-brand-strong ring-1 ring-brand/25",
  vinho: "bg-wine/10 text-wine ring-1 ring-wine/25",
  neutro: "bg-ink/6 text-muted ring-1 ring-ink/10",
  // Sobre fundo escuro.
  claro: "bg-white/10 text-brand-light ring-1 ring-brand/30",
};

const base =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-nota font-semibold tracking-wide";

/**
 * Etiqueta curta: categoria, estado, aviso.
 *
 * Antes esse desenho estava copiado em quatro páginas, cada uma com um raio e
 * uma cor levemente diferentes.
 */
export function Pill({
  children,
  tom = "dourado",
  href,
  icone,
  className = "",
}: {
  children: ReactNode;
  tom?: Tom;
  href?: string;
  icone?: ReactNode;
  className?: string;
}) {
  const classes = `${base} ${tons[tom]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={`${classes} transition-colors hover:bg-brand/20`}>
        {icone}
        {children}
      </Link>
    );
  }

  return (
    <span className={classes}>
      {icone}
      {children}
    </span>
  );
}
