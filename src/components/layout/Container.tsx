import type { ReactNode } from "react";

type Size = "prose" | "wide";

const widths: Record<Size, string> = {
  prose: "max-w-3xl", // leitura confortável (artigos)
  wide: "max-w-6xl", // páginas de vitrine (home, índices)
};

/** Largura máxima e respiro laterais consistentes em todo o portal. */
export function Container({
  children,
  className = "",
  size = "prose",
}: {
  children: ReactNode;
  className?: string;
  size?: Size;
}) {
  return (
    <div
      className={`mx-auto w-full ${widths[size]} px-5 sm:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
