import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Demonstração dos tutoriais", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * As telas do painel com DADOS INVENTADOS, só para tirar os prints dos
 * tutoriais (`npm run ajuda:prints`). Em produção a rota inteira responde 404:
 * aqui nunca passa dado real, e nada aqui chama o banco.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
