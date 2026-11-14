import Link from "next/link";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avaliarItens, listarCampanhas, lerCampanha, ROTULO_DO_STATUS } from "@/lib/campanhas/dados";
import { NovaCampanha } from "./NovaCampanha";
import { COR_DO_STATUS, diaMes as data } from "./status";

export const metadata = { title: "Campanhas" };

/**
 * Campanhas de desconto. A equipe monta, o administrador aprova, e a planilha
 * de promoção sai daqui para a Tray. O alerta de margem aparece para todos
 * (quantos itens passam do limite), mas custo e margem em número, só para o
 * administrador, dentro da campanha.
 */
export default async function CampanhasPage() {
  await requireArea("campanhas");
  const db = await createClient();
  const campanhas = await listarCampanhas(db);

  // Alerta de margem das campanhas que ainda vão para a loja.
  const abertas = campanhas.filter((c) => c.status !== "encerrada" && c.itens > 0);
  const alertas = new Map<string, number>();
  const servico = createAdminClient();
  await Promise.all(
    abertas.map(async (c) => {
      const lida = await lerCampanha(db, c.id);
      if (!lida) return;
      const { porProduto } = await avaliarItens(servico, lida.itens, false);
      alertas.set(c.id, Object.values(porProduto).filter((a) => a.situacao !== "ok").length);
    }),
  );

  return (
    <>
      <header>
        <p className="eyebrow">Loja</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Campanhas</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Monte o desconto de cada produto, mande para aprovação e, depois de aprovada, leve para a loja pela planilha da
          Tray. O painel avisa quando um desconto passa da margem mínima.
        </p>
      </header>

      <NovaCampanha />

      {campanhas.length === 0 ? (
        <p className="glass mt-6 rounded-[20px] px-6 py-12 text-center text-sm text-muted">Nenhuma campanha ainda.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {campanhas.map((c) => {
            const alerta = alertas.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/campanhas/${c.id}`}
                  className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] px-5 py-4 hover:ring-1 hover:ring-brand/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold text-ink">{c.nome}</span>
                    <span className="text-xs text-muted">
                      {data(c.inicio)} a {data(c.fim)} · {c.itens} {c.itens === 1 ? "produto" : "produtos"}
                      {c.criadaPor ? ` · por ${c.criadaPor}` : ""}
                    </span>
                  </span>
                  {alerta ? (
                    <span className="rounded-full bg-wine/10 px-2.5 py-1 text-xs font-semibold text-wine">
                      {alerta} abaixo da margem ou sem custo
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COR_DO_STATUS[c.status]}`}>
                    {ROTULO_DO_STATUS[c.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
