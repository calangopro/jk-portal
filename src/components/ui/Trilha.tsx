import Link from "next/link";

export type Passo = { nome: string; href?: string };

/**
 * Trilha de navegação (breadcrumb) visual.
 *
 * O schema `BreadcrumbList` continua sendo emitido à parte pelos builders; aqui
 * é só a versão que a pessoa vê. Antes o markup estava duplicado na página de
 * guia e na de loja.
 */
export function Trilha({
  passos,
  className = "",
  tom = "claro",
}: {
  passos: Passo[];
  className?: string;
  tom?: "claro" | "escuro";
}) {
  const cor = tom === "escuro" ? "text-white/60" : "text-muted";
  const hover = tom === "escuro" ? "hover:text-brand-light" : "hover:text-brand-nav";
  const atual = tom === "escuro" ? "text-white/85" : "text-ink/70";

  return (
    <nav aria-label="Trilha" className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-nota font-medium ${cor} ${className}`}>
      {passos.map((p, i) => (
        // O passo atual some no celular: o título da página já está logo
        // abaixo, e repetir ele inteiro na trilha come duas linhas de tela.
        <span
          key={`${p.nome}-${i}`}
          className={`items-center gap-2 ${p.href ? "flex" : "hidden sm:flex"}`}
        >
          {p.href ? (
            <Link href={p.href} className={`transition-colors ${hover}`}>
              {p.nome}
            </Link>
          ) : (
            <span aria-current="page" className={atual}>
              {p.nome}
            </span>
          )}
          {i < passos.length - 1 ? (
            <span
              aria-hidden
              className={`opacity-50 ${
                passos[i + 1]?.href ? "" : "hidden sm:inline"
              }`}
            >
              /
            </span>
          ) : null}
        </span>
      ))}
    </nav>
  );
}
