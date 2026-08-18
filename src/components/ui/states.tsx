import type { ReactNode } from "react";

/**
 * Estados sempre previstos (vazio / carregando / erro) — o briefing exige que
 * não exista só o "caminho feliz". Estética de vidro, coerente com o portal.
 */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass rounded-[20px] px-6 py-14 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-3 max-w-md text-apoio text-muted">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-7 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar este conteúdo agora. Tente novamente em instantes.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass rounded-[20px] px-6 py-14 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-apoio text-muted">{description}</p>
      {action ? (
        <div className="mt-7 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}

/** Placeholder de carregamento (usado em loading.tsx / Suspense). */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[12px] bg-border/60 ${className}`}
      aria-hidden="true"
    />
  );
}
