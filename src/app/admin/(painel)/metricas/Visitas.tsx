import Link from "next/link";
import { Users, Clock, ShoppingBag, FileText, ArrowUpRight, Sparkles } from "lucide-react";
import {
  NOME_DA_ORIGEM,
  PERIODOS,
  PROPRIEDADE_GA4,
  lerVisitas,
  type Dias,
  type PaginaVisitada,
  type ProblemaGa4,
  type VisitasDoSite,
} from "@/lib/ga4/visitas";
import { semBasePath } from "@/lib/seo/base-path";
import { absoluteUrl } from "@/lib/seo/site";
import { Cartao, numero } from "./Cartao";

/** 95 s vira "1 min 35 s"; o GA4 entrega segundos. */
function tempo(segundos: number) {
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  const resto = s % 60;
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

function variacao(agora: number, antes: number, dias: number) {
  if (!antes) return `nos últimos ${dias} dias`;
  const pct = ((agora - antes) / antes) * 100;
  const sinal = pct > 0 ? "+" : "";
  return `${sinal}${pct.toFixed(0)}% sobre os ${dias} dias anteriores`;
}

function caminhoNoSite(caminho: string) {
  return semBasePath(caminho) || "/";
}

function Periodos({ dias }: { dias: Dias }) {
  return (
    <nav aria-label="Período" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
      {PERIODOS.map((d) => (
        <Link
          key={d}
          href={`?dias=${d}`}
          scroll={false}
          aria-current={d === dias ? "page" : undefined}
          className={
            d === dias
              ? "rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-ink"
              : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-ink"
          }
        >
          {d} dias
        </Link>
      ))}
    </nav>
  );
}

function Cabecalho({ dias }: { dias: Dias }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="eyebrow">Visitas no site</p>
        <h2 className="font-display mt-1 text-2xl text-ink">Quem leu, de onde veio e o que fez</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Todas as origens, não só o Google. Dados do GA4 até ontem, atualizados de hora em hora.
        </p>
      </div>
      <Periodos dias={dias} />
    </div>
  );
}

function LinhaDePagina({ p }: { p: PaginaVisitada }) {
  const caminho = caminhoNoSite(p.caminho);
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="max-w-[22rem] py-2.5 pr-4">
        <a
          href={absoluteUrl(caminho)}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-ink hover:text-brand-nav hover:underline"
          title={p.titulo || caminho}
        >
          {p.titulo || caminho}
        </a>
        <span className="block truncate text-xs text-muted">{caminho}</span>
      </td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-ink">{numero(p.pessoas)}</td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-muted">{numero(p.visualizacoes)}</td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-muted">{tempo(p.tempoMedio)}</td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-ink">{p.paraLoja ? numero(p.paraLoja) : "·"}</td>
      <td className="numeros py-2.5 text-right text-sm text-ink">{p.contato ? numero(p.contato) : "·"}</td>
    </tr>
  );
}

function TabelaDePaginas({ paginas }: { paginas: PaginaVisitada[] }) {
  const cabeca = (
    <thead>
      <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
        <th scope="col" className="py-2 pr-4 font-semibold">Página</th>
        <th scope="col" className="py-2 pr-4 text-right font-semibold">Pessoas</th>
        <th scope="col" className="py-2 pr-4 text-right font-semibold">Visualizações</th>
        <th scope="col" className="py-2 pr-4 text-right font-semibold">Tempo médio</th>
        <th scope="col" className="py-2 pr-4 text-right font-semibold">Para a loja</th>
        <th scope="col" className="py-2 text-right font-semibold">Contato</th>
      </tr>
    </thead>
  );
  const primeiras = paginas.slice(0, 15);
  const resto = paginas.slice(15, 150);

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse">
          {cabeca}
          <tbody>
            {primeiras.map((p) => <LinhaDePagina key={p.caminho} p={p} />)}
          </tbody>
        </table>
      </div>
      {resto.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">
            Ver as outras {resto.length} páginas
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              {cabeca}
              <tbody>
                {resto.map((p) => <LinhaDePagina key={p.caminho} p={p} />)}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </>
  );
}

export function Problema({ problema }: { problema: ProblemaGa4 }) {
  return (
    <div className="glass mt-5 rounded-[18px] p-6">
      {problema.tipo === "api_desligada" ? (
        <>
          <p className="font-semibold text-ink">Falta ativar a leitura do GA4 no Google Cloud</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              Abra a{" "}
              <a
                href={`https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com${problema.projeto ? `?project=${problema.projeto}` : ""}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-nav hover:underline"
              >
                Google Analytics Data API
              </a>{" "}
              no projeto {problema.projeto ? <code className="text-ink">{problema.projeto}</code> : "da conta de serviço"} e clique em Ativar.
            </li>
            <li>
              No GA4, em Administrador, Gerenciamento de acesso à propriedade, adicione{" "}
              <code className="break-all text-ink">{problema.email}</code> como <strong className="text-ink">Leitor</strong>.
            </li>
            <li>Volte aqui e recarregue. A ativação pode levar alguns minutos para valer.</li>
          </ol>
        </>
      ) : problema.tipo === "sem_acesso" ? (
        <>
          <p className="font-semibold text-ink">Falta dar acesso à conta de serviço no GA4</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              No GA4, abra Administrador e, na coluna da propriedade jkaliancas.com.br
              (<code className="text-ink">{PROPRIEDADE_GA4}</code>), Gerenciamento de acesso à propriedade.
            </li>
            <li>
              Clique em +, Adicionar usuários, cole{" "}
              <code className="break-all text-ink">{problema.email}</code>, escolha a função{" "}
              <strong className="text-ink">Leitor</strong> e desmarque o aviso por e-mail (a conta não tem caixa de entrada).
            </li>
            <li>Volte aqui e recarregue.</li>
          </ol>
        </>
      ) : (
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler o GA4.</span> {problema.mensagem}
        </p>
      )}
      {problema.tipo === "api_desligada" || problema.tipo === "sem_acesso" ? (
        <p className="mt-4 text-xs text-muted">Resposta do Google: {problema.mensagem}</p>
      ) : null}
    </div>
  );
}

export async function Visitas({ dias }: { dias: Dias }) {
  const leitura = await lerVisitas(dias);

  if (!leitura.ok) {
    return (
      <section className="mt-8">
        <Cabecalho dias={dias} />
        <Problema problema={leitura.problema} />
      </section>
    );
  }
  return <PainelDeVisitas dados={leitura.dados} />;
}

/** A parte que só desenha, separada da leitura para poder ser vista sem o GA4. */
export function PainelDeVisitas({ dados }: { dados: VisitasDoSite }) {
  const { dias, totais, anterior, paginas, origens, ias } = dados;
  const totalDeSessoes = origens.reduce((s, o) => s + o.sessoes, 0);
  const sessoesDeIa = ias.reduce((s, o) => s + o.sessoes, 0);

  return (
    <section className="mt-8">
      <Cabecalho dias={dias} />

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao Icone={Users} rotulo="Pessoas" valor={numero(totais.pessoas)} apoio={variacao(totais.pessoas, anterior.pessoas, dias)} />
        <Cartao Icone={FileText} rotulo="Visualizações" valor={numero(totais.visualizacoes)} apoio={variacao(totais.visualizacoes, anterior.visualizacoes, dias)} />
        <Cartao Icone={Clock} rotulo="Tempo médio" valor={tempo(totais.tempoMedio)} apoio="de leitura por pessoa" />
        <Cartao
          Icone={ShoppingBag}
          rotulo="Cliques para a loja"
          valor={numero(totais.paraLoja)}
          apoio={`e ${numero(totais.contato)} de contato (WhatsApp, telefone, rota)`}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">De onde vieram</p>
          <p className="mt-1 text-xs text-muted">Visitas por origem. Uma pessoa pode voltar por caminhos diferentes.</p>
          {origens.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {origens.map((o) => {
                const pct = totalDeSessoes ? (o.sessoes / totalDeSessoes) * 100 : 0;
                return (
                  <li key={o.origem}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink">{NOME_DA_ORIGEM[o.origem]}</span>
                      <span className="numeros shrink-0 text-xs text-muted">
                        {numero(o.sessoes)} · {pct.toFixed(pct < 1 ? 1 : 0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-border/60">
                      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(pct, 0.5)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Nenhuma visita no período.</p>
          )}
        </div>

        <div className="glass rounded-[18px] p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-brand-nav" aria-hidden />
            <p className="eyebrow">Vindas de respostas de IA</p>
          </div>
          <p className="mt-1 text-xs text-muted">
            Gente que clicou num link do site dentro do ChatGPT, Perplexity, Gemini e afins. É o sinal de que o
            conteúdo está sendo citado.
          </p>
          {ias.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {ias.map((ia) => (
                <li key={ia.nome} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                  <span className="text-sm text-ink">{ia.nome}</span>
                  <span className="numeros text-xs text-muted">{numero(ia.sessoes)} visitas</span>
                </li>
              ))}
              <li className="pt-1 text-xs text-muted">
                {totalDeSessoes
                  ? `${((sessoesDeIa / totalDeSessoes) * 100).toFixed(1)}% de todas as visitas do período.`
                  : null}
              </li>
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Nenhuma visita vinda de IA no período.</p>
          )}
        </div>
      </div>

      <div className="glass mt-6 rounded-[18px] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Páginas mais lidas</p>
            <p className="mt-1 text-xs text-muted">
              Os temas que trazem gente e os que levam à loja. É daqui que sai o próximo conteúdo da mesma linha.
            </p>
          </div>
          <a
            href={`https://analytics.google.com/analytics/web/#/p${PROPRIEDADE_GA4}/reports/intelligenthome`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline"
          >
            Abrir no GA4 <ArrowUpRight size={13} aria-hidden />
          </a>
        </div>
        {paginas.length > 0 ? (
          <TabelaDePaginas paginas={paginas} />
        ) : (
          <p className="mt-4 text-sm text-muted">Nenhuma página visitada no período.</p>
        )}
      </div>
    </section>
  );
}

export function VisitasCarregando({ dias }: { dias: Dias }) {
  return (
    <section className="mt-8" aria-busy="true">
      <Cabecalho dias={dias} />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-[8.5rem] animate-pulse rounded-[18px]" />
        ))}
      </div>
      <div className="glass mt-6 h-64 animate-pulse rounded-[18px]" />
    </section>
  );
}
