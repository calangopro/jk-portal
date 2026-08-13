import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "wine" | "dark" | "outline" | "ghost" | "claro";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-wide transition-[transform,box-shadow,background-color,border-color,color] duration-300 disabled:pointer-events-none disabled:opacity-55";

const alturas: Record<Size, string> = {
  sm: "min-h-10 px-5 text-apoio",
  md: "min-h-12 px-7 text-apoio",
  lg: "min-h-14 px-9 text-corpo",
};

// Regra de acessibilidade do manual JK: em botão DOURADO, texto ESCURO
// (#171512). Texto branco sobre #BE9B60 dá 2,61:1 e reprova no WCAG AA.
// Botão bordô leva texto branco, que passa.
const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-ink shadow-[var(--jk-sombra-acao)] hover:bg-brand-light hover:shadow-[var(--jk-sombra-acao-alta)] hover:-translate-y-0.5 active:translate-y-0",
  wine: "bg-wine text-white shadow-[var(--jk-sombra-acao-vinho)] hover:bg-wine-deep hover:-translate-y-0.5 active:translate-y-0",
  dark: "bg-ink text-white hover:bg-charcoal hover:-translate-y-0.5 active:translate-y-0",
  outline:
    "border border-ink/25 bg-white/40 text-ink backdrop-blur-sm hover:border-ink hover:bg-ink hover:text-white hover:-translate-y-0.5 active:translate-y-0",
  // Sobre fundo escuro (modo de medição, faixas de destaque).
  claro:
    "border border-brand/40 bg-white/8 text-[var(--jk-noite-texto)] backdrop-blur-sm hover:border-brand hover:bg-brand hover:text-ink",
  // Sem caixa: para ações secundárias que não devem competir.
  ghost: "text-brand-nav hover:text-brand-strong hover:underline",
};

type Comum = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Ícone à esquerda do rótulo. */
  icone?: ReactNode;
};

type ComoLink = Comum & {
  href: string;
  externo?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;

type ComoBotao = Comum & {
  href?: undefined;
  carregando?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * Botão do portal.
 *
 * Aceita `href` (vira link) ou `onClick` (vira button de verdade). Antes só
 * sabia virar link, e por isso quatro arquivos reescreviam estas classes na
 * mão, cada um divergindo um pouco do original.
 */
export function Button(props: ComoLink | ComoBotao) {
  const {
    children,
    variant = "primary",
    size = "md",
    className = "",
    icone,
  } = props;

  const classes = `${base} ${alturas[size]} ${variants[variant]} ${className}`;

  if ("href" in props && props.href !== undefined) {
    const { href, externo, variant: _v, size: _s, className: _c, icone: _i, children: _ch, ...resto } =
      props as ComoLink;

    if (externo) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className={classes}
          {...resto}
        >
          {icone}
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} {...resto}>
        {icone}
        {children}
      </Link>
    );
  }

  const {
    carregando = false,
    type = "button",
    disabled,
    variant: _v2,
    size: _s2,
    className: _c2,
    icone: _i2,
    children: _ch2,
    ...resto
  } = props as ComoBotao;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? (
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icone
      )}
      {children}
    </button>
  );
}
