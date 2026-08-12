import { Package, ExternalLink, Star } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { trayConfigurada } from "@/lib/tray/cliente";
import { Sincronizar } from "./Sincronizar";

export const metadata = { title: "Produtos" };

type Produto = {
  id: string;
  tray_id: string;
  name: string;
  url: string | null;
  main_image_url: string | null;
  status: string | null;
  is_active: boolean;
  is_champion: boolean;
  last_synced_at: string | null;
};

type Log = {
  status: string;
  error: string | null;
  finished_at: string | null;
  payload: Record<string, number> | null;
};

function quando(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ProdutosPage() {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: produtos, count }, { data: logs }, { count: categorias }] = await Promise.all([
    supabase
      .from("products")
      .select("id, tray_id, name, url, main_image_url, status, is_active, is_champion, last_synced_at", { count: "exact" })
      .order("name")
      .limit(60),
    supabase
      .from("sync_logs")
      .select("status, error, finished_at, payload")
      .eq("source", "tray")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("categories").select("*", { count: "exact", head: true }),
  ]);

  const itens = (produtos ?? []) as Produto[];
  const historico = (logs ?? []) as Log[];
  const configurada = trayConfigurada();

  return (
    <>
      <header>
        <p className="eyebrow">Catálogo</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Produtos</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Espelho do catálogo da Tray, usado para ligar conteúdo a produto e
          emitir dados estruturados com informação real. Preço e estoque não são
          editados aqui.
        </p>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Sincronizar configurada={configurada} />

        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">Últimas sincronizações</p>
          {historico.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {historico.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 text-xs last:border-0">
                  <span className={l.status === "success" ? "text-brand-strong" : "text-wine"}>
                    {l.status === "success"
                      ? `${l.payload?.produtos ?? 0} produtos, ${l.payload?.categorias ?? 0} categorias`
                      : (l.error ?? "erro").slice(0, 90)}
                  </span>
                  <span className="shrink-0 text-muted">{quando(l.finished_at)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-6 border-t border-border/60 pt-4 text-sm">
            <p><span className="font-display text-2xl text-ink">{count ?? 0}</span> <span className="text-muted">produtos</span></p>
            <p><span className="font-display text-2xl text-ink">{categorias ?? 0}</span> <span className="text-muted">categorias</span></p>
          </div>
        </div>
      </section>

      {itens.length === 0 ? (
        <div className="glass mt-6 rounded-[20px] px-6 py-16 text-center">
          <Package className="mx-auto text-brand-nav" size={24} />
          <p className="font-display mt-3 text-2xl text-ink">Catálogo ainda vazio</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {configurada
              ? "Rode a primeira sincronização para trazer os produtos da loja."
              : "Assim que as credenciais da Tray estiverem no servidor, a sincronização traz tudo para cá."}
          </p>
        </div>
      ) : (
        <section className="glass mt-6 overflow-hidden rounded-[20px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-semibold">Produto</th>
                  <th className="px-6 py-4 font-semibold">Situação</th>
                  <th className="px-6 py-4 font-semibold">Sincronizado</th>
                  <th className="px-6 py-4 font-semibold">Loja</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {p.main_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.main_image_url} alt="" className="h-10 w-10 rounded-[8px] object-cover" loading="lazy" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-media text-muted"><Package size={14} /></span>
                        )}
                        <span className="font-medium text-ink">
                          {p.name}
                          {p.is_champion ? <Star size={12} className="ml-1.5 inline text-brand" /> : null}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.is_active ? "bg-brand/15 text-brand-strong" : "bg-ink/10 text-muted"}`}>
                        {p.is_active ? (p.status === "available" ? "Disponível" : "Ativo") : "Inativo"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted">{quando(p.last_synced_at)}</td>
                    <td className="px-6 py-3">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
                          Abrir <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
