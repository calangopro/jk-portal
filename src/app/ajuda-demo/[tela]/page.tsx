import { notFound } from "next/navigation";
import type { Area, AppRole } from "@/lib/auth/acessos";
import { Moldura } from "@/app/admin/(painel)/Moldura";
import type { Demo } from "../tipos";

/** Os níveis que a demonstração sabe desenhar, com o que cada um abre. Dados de exemplo, nunca de gente de verdade. */
const NIVEIS: Record<string, { nome: string; papel: string; papelId: AppRole; areas: Area[] }> = {
  vendas: { nome: "Vendedor Exemplo", papel: "Vendas", papelId: "vendas", areas: ["time", "consulta", "lancar_venda"] },
  gerente: { nome: "Gerente Exemplo", papel: "Gerente", papelId: "gerente", areas: ["time", "consulta", "lancar_venda", "vendas", "suporte", "recuperacao", "trafego", "catalogo", "loja", "campanhas", "fabrica"] },
  diretoria: {
    nome: "Diretoria Exemplo", papel: "GM", papelId: "gm",
    areas: ["time", "consulta", "lancar_venda", "vendas", "suporte", "recuperacao", "trafego", "catalogo", "loja", "campanhas", "fabrica", "metricas", "anuncios", "margem", "custos", "equipe", "conteudo", "site", "redes", "roadmap"],
  },
};

export default async function DemoPage({ params, searchParams }: { params: Promise<{ tela: string }>; searchParams: Promise<{ nivel?: string }> }) {
  const { tela } = await params;
  // Uma tela por arquivo em `../telas/`: tela nova não mexe em lista nenhuma.
  const demo: Demo | null = /^[a-z0-9-]+$/.test(tela) ? await import(`../telas/${tela}`).then((m) => m.default as Demo).catch(() => null) : null;
  const nivel = NIVEIS[(await searchParams).nivel ?? "vendas"] ?? NIVEIS.vendas;
  if (!demo) notFound();
  return (
    <Moldura
      nome={nivel.nome}
      papel={nivel.papel}
      papelId={nivel.papelId}
      areas={nivel.areas}
      pendentes={0}
      avisos={{}}
      contagensDaPrevia={{}}
      meuId={null}
      souAdmin={nivel.papelId === "gm"}
      sair={async () => {
        "use server";
      }}
      caminhoDaPrevia={demo.caminho}
    >
      {demo.desenho(nivel.papelId)}
    </Moldura>
  );
}
