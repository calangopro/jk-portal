import Link from "next/link";
import { Download, RotateCw } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerBio } from "@/lib/bio/ler";
import { NOMES_DOS_TEMAS } from "@/lib/bio/tipos";
import { paginaDoGrupoNoDia } from "@/lib/grupo/montar";
import { normalizarGrupo } from "@/lib/grupo/tipos";
import { lerChaves } from "@/lib/leads/chaves";
import { legivel } from "@/lib/leads/telefone";
import { DESTINOS, NOMES_DOS_DESTINOS, type Destino, type Lead } from "@/lib/leads/tipos";
import { quandoLegivel } from "@/lib/content/agenda";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { SITE } from "@/lib/seo/site";
import { comBasePath } from "@/lib/seo/base-path";
import { ConfigDoGrupo } from "./ConfigDoGrupo";
import { reenviarContato } from "./actions";

export const metadata = { title: "Grupo de ofertas" };

/**
 * O grupo de ofertas no WhatsApp: para onde ele leva e quem deixou o contato.
 *
 * A lista responde a pergunta do gestor de tráfego, "quem teve interesse e não
 * entrou". O site enxerga até o clique no botão do grupo; a entrada de verdade
 * só aparece quando a ferramenta do grupo avisa pelo webhook de entrada.
 */

const FILTROS = {
  todos: "Todos",
  "nao-clicou": "Não foi ao grupo",
  clicou: "Foi ao grupo",
  entrou: "Entrou no grupo",
} as const;
type Filtro = keyof typeof FILTROS;

const SIGLA: Record<Destino, string> = { kommo: "Kommo", rd: "RD", webhook: "Webhook", meta: "Meta" };

const COR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  erro: "bg-wine/12 text-wine",
  sem_chave: "bg-ink/6 text-muted",
  ignorado: "bg-ink/6 text-muted",
};

const ROTULO_DO_STATUS: Record<string, string> = {
  ok: "enviado",
  erro: "falhou",
  sem_chave: "sem chave",
  ignorado: "não se aplica",
};

function trintaDiasAtras(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function GrupoPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const perfil = await requireStaff();
  const { filtro: bruto } = await searchParams;
  const filtro: Filtro = bruto && bruto in FILTROS ? (bruto as Filtro) : "todos";

  const supabase = await createClient();
  const desde = trintaDiasAtras();

  let consulta = supabase.from("leads").select("*").order("criado_em", { ascending: false }).limit(200);
  if (filtro === "nao-clicou") consulta = consulta.is("clicou_grupo_em", null);
  if (filtro === "clicou") consulta = consulta.not("clicou_grupo_em", "is", null);
  if (filtro === "entrou") consulta = consulta.not("entrou_grupo_em", "is", null);

  const contar = () => supabase.from("leads").select("id", { count: "exact", head: true }).gte("criado_em", desde);

  const [config, bio, { data: leads }, total, clicaram, entraram, chaves] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "pagina:grupo").maybeSingle(),
    lerBio(),
    consulta,
    contar(),
    contar().not("clicou_grupo_em", "is", null),
    contar().not("entrou_grupo_em", "is", null),
    lerChaves(createAdminClient()),
  ]);

  const grupo = normalizarGrupo(config.data?.value);
  const hoje = paginaDoGrupoNoDia(bio, { ...grupo, tema: "campanha" }, hojeEmSaoPaulo());
  const lista = (leads ?? []) as Lead[];
  const n = (r: { count: number | null }) => r.count ?? 0;

  const configurados: Record<Destino, boolean> = {
    kommo: Boolean(chaves.kommo),
    rd: Boolean(chaves.rd_station),
    webhook: Boolean(chaves.grupo_webhook),
    meta: Boolean(chaves.meta_capi),
  };
  const entrada = chaves.grupo_entrada
    ? `${SITE.lojaUrl}${comBasePath("/api/grupo/entrou")}?segredo=${encodeURIComponent(chaves.grupo_entrada.valor)}`
    : null;

  return (
    <>
      <header>
        <p className="eyebrow">Site</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Grupo de ofertas</h1>
        <p className="mt-3 max-w-2xl text-muted">
          A página do anúncio (jkaliancas.com.br/grupo), o link fixo do grupo e todo mundo que deixou o contato, pela
          página ou pelo link da bio.
        </p>
      </header>

      <div className="mt-8">
        <ConfigDoGrupo inicial={grupo} temaDeHoje={NOMES_DOS_TEMAS[hoje.tema]} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">Últimos 30 dias</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          {(
            [
              ["Deixaram o contato", n(total)],
              ["Foram ao grupo", n(clicaram)],
              ["Não foram ao grupo", n(total) - n(clicaram)],
              ["Entraram no grupo", n(entraram)],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} className="glass rounded-[16px] p-4">
              <dt className="text-xs text-muted">{rotulo}</dt>
              <dd className="numeros mt-1 font-display text-3xl text-ink">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
          &quot;Foram ao grupo&quot; é quem tocou no botão do grupo depois do cadastro. &quot;Entraram&quot; só conta
          quando a ferramenta do grupo avisa a entrada pelo webhook abaixo; sem ele, fica em zero.
        </p>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">Contatos</h2>
          <a
            href={`${comBasePath("/admin/grupo/contatos.csv")}?filtro=${filtro}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:bg-white"
          >
            <Download size={13} aria-hidden />
            Baixar planilha (CSV)
          </a>
        </div>

        <nav aria-label="Filtrar contatos" className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(FILTROS) as Filtro[]).map((f) => (
            <Link
              key={f}
              href={f === "todos" ? "/admin/grupo" : `/admin/grupo?filtro=${f}`}
              aria-current={f === filtro ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                f === filtro ? "bg-ink text-white" : "border border-border text-ink hover:border-brand/50"
              }`}
            >
              {FILTROS[f]}
            </Link>
          ))}
        </nav>

        <p className="mt-3 text-xs text-muted">
          Para onde vão:{" "}
          {DESTINOS.map((d, i) => (
            <span key={d}>
              {i > 0 ? ", " : ""}
              {NOMES_DOS_DESTINOS[d]}{" "}
              <span className={configurados[d] ? "text-emerald-800" : "text-wine"}>
                ({configurados[d] ? "ligado" : "sem chave"})
              </span>
            </span>
          ))}
          .{" "}
          {perfil.role === "admin" ? (
            <Link href="/admin/integracoes" className="font-semibold text-brand-nav hover:underline">
              Configurar em Integrações
            </Link>
          ) : null}
        </p>

        {lista.length === 0 ? (
          <p className="mt-5 rounded-[14px] border border-dashed border-border px-5 py-4 text-sm leading-relaxed text-muted">
            Nenhum contato {filtro === "todos" ? "ainda" : "neste filtro"}.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-[16px] border border-border bg-white/60">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Quando</th>
                  <th scope="col" className="px-4 py-3 font-medium">Contato</th>
                  <th scope="col" className="px-4 py-3 font-medium">De onde veio</th>
                  <th scope="col" className="px-4 py-3 font-medium">Grupo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Envios</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => {
                  const falhou = DESTINOS.some((d) => l.envios[d]?.status === "erro");
                  return (
                    <tr key={l.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                        {quandoLegivel(l.criado_em)}
                        <span className="mt-0.5 block">
                          {l.origem === "grupo" ? "página /grupo" : "link da bio"}
                          {l.campanha ? `, ${l.campanha}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink">{l.nome}</span>
                        <a
                          href={`https://wa.me/${l.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-brand-nav hover:underline"
                        >
                          {legivel(l.whatsapp)}
                        </a>
                        {l.email ? <span className="block break-all text-xs text-muted">{l.email}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {[l.utm_source || l.rede, l.utm_medium].filter(Boolean).join(" / ") || "direto"}
                        {l.utm_campaign ? (
                          <span className="mt-0.5 block break-all text-ink/80">
                            {[l.utm_campaign, l.utm_content].filter(Boolean).join(" / ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {l.entrou_grupo_em ? (
                          <span className="text-emerald-800">Entrou</span>
                        ) : l.clicou_grupo_em ? (
                          <span className="text-ink">Foi ao grupo</span>
                        ) : (
                          <span className="text-wine">Não foi</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {DESTINOS.map((d) => {
                            const s = l.envios[d];
                            const status = s?.status ?? "sem_chave";
                            return (
                              <span
                                key={d}
                                title={s?.erro ?? s?.ref ?? ""}
                                className={`rounded-full px-2 py-0.5 text-[0.66rem] font-semibold ${COR[status]}`}
                              >
                                {SIGLA[d]}: {ROTULO_DO_STATUS[status]}
                              </span>
                            );
                          })}
                        </div>
                        {falhou ? (
                          <form action={reenviarContato} className="mt-2">
                            <input type="hidden" name="id" value={l.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-brand-nav hover:underline"
                            >
                              <RotateCw size={11} aria-hidden />
                              Tentar de novo
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {lista.length === 200 ? (
          <p className="mt-2 text-xs text-muted">Mostrando os 200 mais recentes. A planilha traz todos.</p>
        ) : null}
      </section>

      {perfil.role === "admin" && entrada ? (
        <section className="glass mt-10 rounded-[18px] p-5">
          <h2 className="font-medium text-ink">Aviso de entrada no grupo</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            Na ferramenta do grupo (DevZapp), cadastre este endereço no webhook de &quot;entrou no grupo&quot;. A cada
            entrada, o contato ganha &quot;Entrou&quot; aqui, e dá para separar quem se cadastrou e não entrou. O endereço
            leva uma senha: não publique.
          </p>
          <code className="mt-3 block break-all rounded-[8px] bg-ink/5 px-2 py-1.5 text-[0.7rem] text-ink">{entrada}</code>
        </section>
      ) : null}
    </>
  );
}
