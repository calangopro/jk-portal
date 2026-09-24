import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDaBio } from "@/components/bio/PaginaDaBio";
import { lerBio } from "@/lib/bio/ler";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { isProduction } from "@/lib/seo/site";

/**
 * A bio num dia escolhido: `/bio/previa?data=2026-11-10` mostra a Black.
 *
 * Serve para conferir a campanha antes de ela entrar no ar, sem mexer em
 * relógio nenhum. Em produção ela ainda não abre: quando o painel da bio
 * existir, a prévia passa a exigir sessão de quem é da equipe. Até lá, abrir
 * isto em produção seria mostrar a Black em outubro para qualquer um, e o
 * Esquenta tem regra de não antecipar novembro.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prévia do link da bio",
  robots: { index: false, follow: false },
};

export default async function PreviaDaBio({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  if (isProduction()) notFound();

  const { data } = await searchParams;
  const dia = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeEmSaoPaulo();
  return <PaginaDaBio bio={await lerBio()} hoje={dia} />;
}
