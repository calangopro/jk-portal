import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { trayConfigurada } from "@/lib/tray/cliente";
import { listarCatalogo, lerPadroes } from "@/lib/catalogo/fotos";
import { margensDoCatalogo } from "@/lib/margem/dados";
import type { MargemNaLista } from "./util";
import { Sincronizar } from "./Sincronizar";
import { Catalogo } from "./Catalogo";

export const metadata = { title: "Produtos" };

// O botão "Sincronizar agora" roda dentro desta rota, e ler a loja inteira
// leva uns dez segundos.
export const maxDuration = 60;

type Log = {
  status: string;
  error: string | null;
  finished_at: string | null;
  payload: Record<string, number> | null;
};

function quando(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

/**
 * O catálogo da loja como lista de trabalho.
 *
 * Uma tela só para as três frentes (foto nova, margem e campanha), em vez de
 * uma ferramenta para cada: são colunas do mesmo produto, e a pessoa precisa
 * ver as três juntas para decidir. Nesta primeira fase, a frente é a foto.
 *
 * A lista inteira vem de uma vez (cerca de mil linhas leves) e o filtro roda no
 * navegador, para buscar e trocar de filtro sem esperar o servidor.
 */
export default async function ProdutosPage() {
  const perfil = await requireStaff();
  const supabase = await createClient();

  const [itens, padroes, { data: logs }] = await Promise.all([
    listarCatalogo(supabase),
    lerPadroes(supabase),
    supabase
      .from("sync_logs")
      .select("status, error, finished_at, payload")
      .eq("source", "tray")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Custo é da empresa: só o administrador recebe a margem no navegador.
  let margens: Record<string, MargemNaLista> | null = null;
  if (perfil.role === "admin") {
    const { porProduto } = await margensDoCatalogo(supabase, itens);
    margens = Object.fromEntries(
      Object.entries(porProduto).map(([id, c]) => [
        id,
        {
          custo: c.custo,
          detalhe: c.detalhe,
          falta: c.falta,
          reais: c.margem?.reais ?? null,
          fracao: c.margem?.fracao ?? null,
          descontoMaximo: c.margem?.descontoMaximo ?? null,
          abaixo: c.margem?.abaixoDoMinimo ?? false,
          descontoHoje: c.margem?.descontoHoje ?? null,
          fracaoHoje: c.margem?.fracaoHoje ?? null,
          hojePassa: c.margem?.hojePassa ?? false,
          material: c.gravado?.material ?? null,
          familia: c.gravado?.familia ?? null,
          gramas: c.gravado?.gramas ?? null,
          resto: c.gravado?.resto ?? null,
          custoFixo: c.gravado?.custoFixo ?? null,
        } satisfies MargemNaLista,
      ]),
    );
  }

  const historico = (logs ?? []) as Log[];
  const ultima = historico.find((l) => l.status === "success");

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Loja</p>
          <h1 className="font-display mt-2 text-4xl text-ink">Produtos</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Cada peça da loja com preço, link e a foto nova. A lista mostra o que
            falta, o que espera aprovação e o que já está na loja.
          </p>
        </div>
        <p className="text-xs text-muted">
          Preço e estoque vêm da Tray. Última leitura da loja: {quando(ultima?.finished_at ?? null)}.
        </p>
      </header>

      <Catalogo itens={itens} padroes={padroes} margens={margens} />

      <details className="glass mt-10 rounded-[18px] p-5">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Sincronização com a loja
        </summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Sincronizar configurada={trayConfigurada()} />
          <div>
            <p className="eyebrow">Últimas sincronizações</p>
            {historico.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {historico.map((l, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 text-xs last:border-0">
                    <span className={l.status === "success" ? "text-brand-strong" : "text-wine"}>
                      {l.status === "success"
                        ? `${l.payload?.produtos ?? 0} produtos, ${l.payload?.alterados ?? 0} atualizados`
                        : (l.error ?? "erro").slice(0, 90)}
                    </span>
                    <span className="shrink-0 text-muted">{quando(l.finished_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
