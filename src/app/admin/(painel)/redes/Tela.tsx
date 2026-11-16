import Link from "next/link";
import { ArrowUpRight, Cable, CircleAlert, CircleCheck, Eye, Heart, Images, UsersRound } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { ehRede, nomeDaRede, nomeDoFormatoNaRede, type Formato } from "@/lib/redes/redes";
import { compacto, haQuanto, type ContaNoResumo, type Medida, type PublicacaoNoResumo, type Resumo } from "@/lib/redes/resumo";
import { Cartao, SeloDeTom, Variacao } from "../Pecas";
import { Miniatura } from "./Miniatura";

/**
 * "Todas as redes", só o desenho. A leitura fica em `page.tsx`, para a tela
 * poder ser vista com dado de exemplo durante o desenvolvimento.
 *
 * De cima para baixo: o total somado, uma faixa por conta e os posts que mais
 * renderam. Desenhada para 375 px primeiro: os cartões andam de dois em dois e
 * cada conta é um bloco que cabe na tela sem rolar de lado.
 *
 * Número que a rede não informa aparece como "a rede não informa", e não como
 * zero: zero faria o YouTube parecer sem alcance, quando ele só não diz.
 */

const NAO_INFORMA = "a rede não informa";

function Numero({ rotulo, m, vazio = NAO_INFORMA }: { rotulo: string; m: Medida; vazio?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted">{rotulo}</p>
      {m.valor === null ? (
        <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">{vazio}</p>
      ) : (
        <>
          <p className="font-display numeros mt-0.5 text-lg leading-tight text-ink">{compacto(m.valor)}</p>
          <p className="mt-0.5">
            <Variacao d={m.variacao} />
          </p>
        </>
      )}
    </div>
  );
}

/**
 * A forma do período, sem eixo: sobe ou desce. Diferente da `Linhazinha` do
 * painel, esta começa no MENOR valor e não no zero: seguidores variam décimos
 * de por cento num mês, e a partir do zero toda conta viraria uma linha reta.
 * O tamanho da mudança quem diz é o número ao lado ("+2.420 em 28 dias").
 */
function Tendencia({ valores }: { valores: number[] }) {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const x = (i: number) => (i / Math.max(valores.length - 1, 1)) * 100;
  const y = (v: number) => 25 - ((v - min) / faixa) * 21;
  const linha = valores.map((v, i) => `${x(i)},${max === min ? 14 : y(v)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true">
      <polygon points={`0,28 ${linha} 100,28`} fill="var(--setor)" opacity="0.1" />
      <polyline points={linha} fill="none" stroke="var(--setor)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const FORMATOS: Formato[] = ["post", "carrossel", "video_curto", "story", "video", "texto"];

/** "Reels", "Story", "Carrossel": o formato do jeito que aquela rede chama. */
function formatoEmPalavra(formato: string | null, rede: string): string | null {
  if (!formato || !ehRede(rede) || !FORMATOS.includes(formato as Formato)) return null;
  return nomeDoFormatoNaRede(formato as Formato, rede);
}

function FaixaDaConta({ c, agora, dias }: { c: ContaNoResumo; agora: number; dias: number }) {
  const lida = haQuanto(c.lidaEm, agora);
  const rede = nomeDaRede(c.rede);
  const comProblema = c.status === "expirada" || Boolean(c.ultimoErro);
  return (
    <li className="glass rounded-[18px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <SeloDaRede id={c.rede} tamanho={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{rede}</p>
            <p className="truncate text-xs text-muted">{c.nome}</p>
          </div>
        </div>
        {c.status === "expirada" ? (
          <SeloDeTom tom="ruim">Ligar de novo</SeloDeTom>
        ) : c.ultimoErro ? (
          <SeloDeTom tom="atencao">Leitura incompleta</SeloDeTom>
        ) : lida ? (
          <SeloDeTom tom="neutro">Lida {lida}</SeloDeTom>
        ) : (
          <SeloDeTom tom="neutro">Primeira leitura a caminho</SeloDeTom>
        )}
      </div>

      {comProblema ? (
        <p className="mt-3 break-words rounded-[10px] bg-ink/[0.04] px-3 py-2 text-xs leading-relaxed text-ink">
          {c.status === "expirada" ? "O acesso venceu ou foi retirado. " : ""}
          {c.ultimoErro}{" "}
          <Link href="/admin/redes/contas" className="font-semibold text-[var(--setor)] underline underline-offset-2">
            Ver em Contas ligadas
          </Link>
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-end gap-4">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted">Seguidores</p>
          <p className="font-display numeros mt-0.5 text-[clamp(1.5rem,7vw,2rem)] leading-none text-ink">
            {c.seguidores.valor === null ? "sem dado" : compacto(c.seguidores.valor)}
          </p>
          <p className="mt-1 text-[0.7rem] leading-snug text-muted">
            {c.ganho === null ? (
              "sem comparação ainda"
            ) : c.ganho === 0 ? (
              `igual em ${dias} dias`
            ) : (
              <>
                <span className="font-semibold text-ink">
                  {c.ganho > 0 ? "+" : "-"}
                  {compacto(Math.abs(c.ganho))}
                </span>{" "}
                em {dias} dias
              </>
            )}
          </p>
        </div>
        {c.serieDeSeguidores.length > 1 ? <Tendencia valores={c.serieDeSeguidores} /> : <p className="text-right text-[0.7rem] leading-snug text-muted">O gráfico aparece com dois dias de leitura.</p>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ink/[0.07] pt-4">
        <Numero rotulo="Visualizações" m={c.visualizacoes} />
        <Numero rotulo="Alcance" m={c.alcance} />
        <Numero rotulo="Interações" m={c.interacoes} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted">
        <p>
          <span className="font-semibold text-ink">{c.publicacoes.valor ?? 0}</span> {c.publicacoes.valor === 1 ? "publicação" : "publicações"} em {dias} dias
          {c.engajamento !== null ? (
            <>
              {" · "}
              <span className="font-semibold text-ink">{c.engajamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span> interações a cada 100 {c.baseDoEngajamento}
            </>
          ) : null}
        </p>
        {c.link ? (
          <a href={c.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-[var(--setor)]">
            Abrir o perfil <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "";

function LinhaDoPost({ p, posicao }: { p: PublicacaoNoResumo; posicao?: number }) {
  const legenda = (p.legenda ?? "").trim() || "Sem legenda";
  const miolo = (
    <>
      <Miniatura src={p.miniatura_url} rede={p.rede} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[0.68rem] text-muted">
          {posicao ? <span className="font-bold text-ink">{posicao}º</span> : null}
          <span className="font-semibold text-ink">{nomeDaRede(p.rede)}</span>
          {formatoEmPalavra(p.formato, p.rede) ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatoEmPalavra(p.formato, p.rede)}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{dataCurta(p.publicado_em)}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-sm leading-snug text-ink">{legenda}</p>
        <p className="numeros mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7rem] text-muted">
          <span>
            <span className="font-semibold text-ink">{compacto(p.interacoes)}</span> interações
          </span>
          {p.visualizacoes !== null ? (
            <span>
              <span className="font-semibold text-ink">{compacto(p.visualizacoes)}</span> visualizações
            </span>
          ) : p.alcance !== null ? (
            <span>
              <span className="font-semibold text-ink">{compacto(p.alcance)}</span> pessoas
            </span>
          ) : null}
          {p.comentarios ? (
            <span>
              <span className="font-semibold text-ink">{compacto(p.comentarios)}</span> comentários
            </span>
          ) : null}
        </p>
      </div>
    </>
  );
  return (
    <li className="py-3">
      {p.link ? (
        <a href={p.link} target="_blank" rel="noreferrer" className="flex items-start gap-3">
          {miolo}
        </a>
      ) : (
        <div className="flex items-start gap-3">{miolo}</div>
      )}
    </li>
  );
}

export function TelaDasRedes({
  resumo, dias, periodos, agora, podeLigar,
}: {
  resumo: Resumo | null;
  dias: number;
  periodos: number[];
  agora: number;
  podeLigar: boolean;
}) {
  const contas = resumo?.contas ?? [];
  const pedemAcao = contas.filter((c) => c.status === "expirada").length;

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Redes</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Todas as redes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Os números de cada rede ligada, lado a lado. O painel lê as redes sozinho, em segundo plano, e esta tela mostra a última leitura.
          </p>
        </div>
        <nav aria-label="Período" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface/60 p-1">
          {periodos.map((p) => (
            <Link
              key={p}
              href={`?dias=${p}`}
              scroll={false}
              aria-current={p === dias ? "page" : undefined}
              className={"shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-3.5 " + (p === dias ? "painel-aba-ativa" : "text-muted hover:text-ink")}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </header>

      {resumo === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler os números agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : contas.length === 0 ? (
        <div className="glass mt-6 rounded-[20px] px-5 py-10 text-center sm:px-8 sm:py-14">
          <span className="painel-selo mx-auto grid h-12 w-12 place-items-center rounded-[14px]">
            <Cable size={22} aria-hidden="true" />
          </span>
          <p className="font-display mt-4 text-2xl text-ink">Nenhuma rede ligada ainda</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Ligando o Instagram, o Facebook e o YouTube, os seguidores, o alcance e os posts de cada um aparecem aqui, lado a lado.
            {podeLigar ? "" : " Ligar uma rede é de administrador, dono ou GM."}
          </p>
          <LinkRapido href="/admin/redes/contas" className="painel-toque mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
            Ver o que falta para ligar <ArrowUpRight size={15} aria-hidden="true" />
          </LinkRapido>
        </div>
      ) : (
        <>
          {pedemAcao > 0 ? (
            <p role="status" className="mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold" style={{ color: "#b01919", background: "#fde8e8" }}>
              <CircleAlert size={15} aria-hidden="true" />
              {pedemAcao === 1 ? "1 conta precisa ser ligada de novo" : `${pedemAcao} contas precisam ser ligadas de novo`}
            </p>
          ) : null}

          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Total das redes">
            <Cartao
              Icone={UsersRound}
              rotulo="Seguidores somados"
              variacao={{ d: resumo.total.seguidores.variacao }}
              apoio={resumo.total.ganho === null ? undefined : `${resumo.total.ganho >= 0 ? "+" : "-"}${compacto(Math.abs(resumo.total.ganho))} em ${dias} dias`}
            >
              {compacto(resumo.total.seguidores.valor)}
            </Cartao>
            <Cartao Icone={Eye} rotulo="Visualizações" variacao={{ d: resumo.total.visualizacoes.variacao }}>
              {compacto(resumo.total.visualizacoes.valor)}
            </Cartao>
            <Cartao Icone={Heart} rotulo="Interações" variacao={{ d: resumo.total.interacoes.variacao }} apoio="curtidas, comentários, salvos e compartilhamentos">
              {compacto(resumo.total.interacoes.valor)}
            </Cartao>
            <Cartao Icone={Images} rotulo="Publicações" variacao={{ d: resumo.total.publicacoes.variacao }}>
              {compacto(resumo.total.publicacoes.valor)}
            </Cartao>
          </section>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
            Seguidores somados contam duas vezes quem segue a JK em duas redes. A comparação é com os {dias} dias anteriores.
          </p>

          {resumo.semLeitura ? (
            <p role="status" className="glass mt-5 flex items-start gap-2 rounded-[14px] p-4 text-sm text-ink">
              <CircleCheck size={16} className="mt-0.5 shrink-0 text-[var(--setor)]" aria-hidden="true" />
              Conta ligada. A primeira leitura está a caminho: os números aparecem em um ou dois minutos, recarregando a página.
            </p>
          ) : null}

          <section className="mt-8" aria-labelledby="titulo-contas">
            <h2 id="titulo-contas" className="text-sm font-semibold text-ink">
              Rede por rede
            </h2>
            <ul className="mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {contas.map((c) => (
                <FaixaDaConta key={c.id} c={c} agora={agora} dias={dias} />
              ))}
            </ul>
          </section>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-melhores">
              <h2 id="titulo-melhores" className="text-sm font-semibold text-ink">
                O que mais rendeu em {dias} dias
              </h2>
              <p className="mt-0.5 text-xs text-muted">Pela soma de curtidas, comentários, salvos e compartilhamentos.</p>
              {resumo.melhores.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nenhuma publicação com interação neste período.</p>
              ) : (
                <ol className="mt-1 divide-y divide-ink/[0.07]">
                  {resumo.melhores.map((p, i) => (
                    <LinhaDoPost key={p.id} p={p} posicao={i + 1} />
                  ))}
                </ol>
              )}
            </section>

            <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-recentes">
              <h2 id="titulo-recentes" className="text-sm font-semibold text-ink">
                Últimas publicações
              </h2>
              <p className="mt-0.5 text-xs text-muted">De todas as redes, da mais nova para a mais antiga.</p>
              {resumo.recentes.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nenhuma publicação neste período.</p>
              ) : (
                <ul className="mt-1 divide-y divide-ink/[0.07]">
                  {resumo.recentes.map((p) => (
                    <LinhaDoPost key={p.id} p={p} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
