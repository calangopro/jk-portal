"use client";

import { useMemo, useState } from "react";
import { CircleCheck, FolderTree, GitBranch, GitPullRequest, Inbox, Loader2, Plus, TriangleAlert } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import {
  COLUNAS, COLUNAS_DO_QUADRO, FRASE_DA_COLUNA, NOME_DA_COLUNA, NOME_DA_PRIORIDADE, NOME_DO_TIPO, PRIORIDADES, TIPOS,
  filtrarCartoes, numeroDoPr, paresQueCruzam, porColuna, quemEstaFazendo,
  type Cartao, type Coluna, type FiltroDePessoa, type FiltroDeTipo, type Prioridade, type Quadro, type SugestaoNova, type Tipo,
} from "@/lib/roadmap/roadmap";
import { GavetaDoCartao } from "./Gaveta";
import { NovoCartao } from "./NovoCartao";
import { ChipDoTipo, Dono, SeloDaPrioridade, Selecao, quando } from "./pecas";
import type { Acoes } from "./tipos";

type Eu = { id: string; nome: string };

/**
 * O quadro. No celular, uma coluna por vez, escolhida nas abas de cima (com a
 * contagem de cada uma); de 1280 px para cima, as cinco lado a lado. O cartão
 * se move pela gaveta, com seleção e botão: arrastar não funciona bem no dedo
 * e não serve a quem usa teclado.
 */
export function QuadroDoRoadmap({ quadro, eu, abrir, acoes }: { quadro: Quadro | null; eu: Eu; abrir: number | null; acoes: Acoes }) {
  const [aberto, setAberto] = useState<number | null>(abrir);
  const [novo, setNovo] = useState(false);
  const [pessoa, setPessoa] = useState<FiltroDePessoa>("todos");
  const [tipo, setTipo] = useState<FiltroDeTipo>("todos");
  const [coluna, setColuna] = useState<Coluna>(() => {
    // No celular, abre na coluna que mais importa: o que está sendo feito, se houver.
    const cartoes = quadro?.cartoes ?? [];
    return cartoes.some((c) => c.coluna === "fazendo") ? "fazendo" : cartoes.some((c) => c.coluna === "a_fazer") ? "a_fazer" : "ideias";
  });

  const cartoes = useMemo(() => quadro?.cartoes ?? [], [quadro]);
  const visiveis = useMemo(() => filtrarCartoes(cartoes, pessoa, tipo), [cartoes, pessoa, tipo]);
  const colunas = useMemo(() => porColuna(visiveis), [visiveis]);
  const pares = useMemo(() => paresQueCruzam(cartoes), [cartoes]);
  const fazendo = useMemo(() => quemEstaFazendo(cartoes), [cartoes]);
  const comCartao = useMemo(() => {
    const ids = new Set(cartoes.map((c) => c.responsavelId).filter(Boolean));
    return (quadro?.pessoas ?? []).filter((p) => ids.has(p.id) && p.id !== eu.id);
  }, [cartoes, quadro, eu.id]);

  if (!quadro) {
    return (
      <div data-painel-largo>
        <Cabecalho aoCriar={null} />
        <p role="alert" className="mt-5 rounded-[12px] border border-wine/30 bg-wine/5 px-4 py-3 text-sm text-ink">
          Não deu para ler o quadro agora. Recarregue a página em alguns segundos.
        </p>
      </div>
    );
  }

  return (
    <div data-painel-largo>
      <Cabecalho aoCriar={() => setNovo(true)} />

      {/* Quem está mexendo em quê, e o aviso de dois no mesmo lugar */}
      <section aria-label="Em trabalho agora" className="mt-5 grid grid-cols-1 gap-3">
        <div className="glass min-w-0 rounded-[16px] p-4">
          <p className="eyebrow">Em trabalho agora</p>
          {fazendo.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">Ninguém está com cartão em Fazendo ou Em revisão.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {fazendo.map((f) => (
                <li key={f.id} className="min-w-0 text-sm">
                  <Dono nome={f.nome} viaClaude={false} />
                  <span className="ml-1.5 text-muted">
                    {[f.fazendo ? `${f.fazendo} fazendo` : null, f.emRevisao ? `${f.emRevisao} em revisão` : null].filter(Boolean).join(", ")}
                    {f.peloClaude ? `, ${f.peloClaude} pelo Claude` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pares.length > 0 ? (
          <div role="status" className="min-w-0 rounded-[16px] px-4 py-3" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
            <p className="flex items-start gap-2 text-sm font-semibold">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {pares.length === 1 ? "Dois cartões em trabalho mexem no mesmo lugar" : `${pares.length} pares de cartões em trabalho mexem no mesmo lugar`}
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-2 pl-6 text-sm text-ink">
              {pares.map(({ a, b, cruzam }) => (
                <li key={`${a.id}-${b.id}`} className="min-w-0">
                  <button type="button" onClick={() => setAberto(a.id)} className="inline text-left font-semibold underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                    {a.id}. {a.titulo}
                  </button>
                  <span className="text-muted"> ({a.responsavel ?? "sem dono"}) e </span>
                  <button type="button" onClick={() => setAberto(b.id)} className="inline text-left font-semibold underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                    {b.id}. {b.titulo}
                  </button>
                  <span className="text-muted"> ({b.responsavel ?? "sem dono"})</span>
                  <span className="mt-0.5 block font-mono text-[0.72rem] text-muted [overflow-wrap:anywhere]">
                    {cruzam.map((x) => (x.meu === x.dele ? x.meu : `${x.meu} cruza com ${x.dele}`)).join("; ")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 pl-6 text-xs text-ink/80">Combinem quem junta primeiro. O segundo atualiza o ramo depois, antes de juntar.</p>
          </div>
        ) : null}

        {quadro.sugestoes.length > 0 ? <Entrada sugestoes={quadro.sugestoes} acoes={acoes} aoLevar={setAberto} /> : null}
      </section>

      {/* Filtros */}
      <section aria-label="Filtros" className="mt-5 grid grid-cols-1 gap-2">
        <Fila rotulo="Pessoa">
          <Botao ativo={pessoa === "todos"} onClick={() => setPessoa("todos")}>Todos</Botao>
          <Botao ativo={pessoa === eu.id} onClick={() => setPessoa(eu.id)}>Meus</Botao>
          {comCartao.map((p) => (
            <Botao key={p.id} ativo={pessoa === p.id} onClick={() => setPessoa(p.id)}>{p.nome.split(" ")[0]}</Botao>
          ))}
          <Botao ativo={pessoa === "sem_dono"} onClick={() => setPessoa("sem_dono")}>Sem dono</Botao>
        </Fila>
        <Fila rotulo="Tipo">
          <Botao ativo={tipo === "todos"} onClick={() => setTipo("todos")}>Todos</Botao>
          {TIPOS.map((t) => (
            <Botao key={t} ativo={tipo === t} onClick={() => setTipo(t)}>{NOME_DO_TIPO[t]}</Botao>
          ))}
        </Fila>
      </section>

      {/* Abas de coluna, até 1279 px */}
      <nav aria-label="Colunas do quadro" className="relative mt-4 flex gap-1.5 overflow-x-auto pb-1 xl:hidden">
        {COLUNAS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={coluna === c}
            onClick={() => setColuna(c)}
            className={`painel-toque shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
              coluna === c ? "border-transparent text-white" : "border-border bg-white text-ink"
            }`}
            style={coluna === c ? { background: "var(--setor, #55606e)" } : undefined}
          >
            {NOME_DA_COLUNA[c]} <span className="numeros opacity-75">{colunas[c].length}</span>
          </button>
        ))}
      </nav>

      <div className="mt-3 grid grid-cols-1 gap-4 xl:mt-5 xl:grid-cols-5">
        {COLUNAS_DO_QUADRO.map((c) => (
          <ColunaDoQuadro key={c} coluna={c} cartoes={colunas[c]} ativa={coluna === c} aoAbrir={setAberto} />
        ))}
      </div>

      <Descartados cartoes={colunas.descartado} ativa={coluna === "descartado"} aoAbrir={setAberto} />

      {novo ? (
        <NovoCartao
          acoes={acoes}
          aoFechar={() => setNovo(false)}
          aoCriar={(id) => {
            setNovo(false);
            setAberto(id);
          }}
        />
      ) : null}
      {aberto !== null ? <GavetaDoCartao key={aberto} id={aberto} eu={eu} pessoas={quadro.pessoas} acoes={acoes} aoFechar={() => setAberto(null)} /> : null}
    </div>
  );
}

function Cabecalho({ aoCriar }: { aoCriar: (() => void) | null }) {
  return (
    <header>
      <p className="eyebrow">Sistema</p>
      <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Roadmap</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
        O que mexer no código do painel, quem está mexendo e onde. Antes de começar, pegue o cartão e diga os caminhos que vai mexer: o quadro avisa
        quando outro trabalho já está no mesmo lugar.
      </p>
      {aoCriar ? (
        <button
          type="button"
          onClick={aoCriar}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85"
        >
          <Plus size={15} aria-hidden="true" /> Novo cartão
        </button>
      ) : null}
    </header>
  );
}

function Fila({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-12 shrink-0 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{rotulo}</span>
      <div role="group" aria-label={rotulo} className="relative flex min-w-0 gap-1.5 overflow-x-auto pb-1">
        {children}
      </div>
    </div>
  );
}

function Botao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`painel-toque shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
        ativo ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ColunaDoQuadro({ coluna, cartoes, ativa, aoAbrir }: { coluna: Coluna; cartoes: Cartao[]; ativa: boolean; aoAbrir: (id: number) => void }) {
  return (
    <section aria-labelledby={`coluna-${coluna}`} className={`${ativa ? "" : "hidden"} min-w-0 xl:block`}>
      <div className="flex items-baseline justify-between gap-2 xl:border-b xl:border-ink/[0.08] xl:pb-2">
        <h2 id={`coluna-${coluna}`} className="flex items-center gap-1.5 text-sm font-bold text-ink">
          {coluna === "no_ar" ? <CircleCheck size={14} style={{ color: COR_DO_TOM.bom.texto }} aria-hidden="true" /> : null}
          {NOME_DA_COLUNA[coluna]}
          <span className="numeros font-semibold text-muted">{cartoes.length}</span>
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted">{FRASE_DA_COLUNA[coluna]}</p>
      {cartoes.length === 0 ? (
        <p className="mt-3 rounded-[12px] border border-dashed border-ink/15 px-3 py-4 text-center text-xs text-muted">Nada aqui.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2.5">
          {cartoes.map((c) => (
            <CartaoNoQuadro key={c.id} c={c} aoAbrir={aoAbrir} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CartaoNoQuadro({ c, aoAbrir }: { c: Cartao; aoAbrir: (id: number) => void }) {
  const pr = numeroDoPr(c.prUrl);
  const cruza = c.conflitos.length > 0 && c.coluna !== "no_ar" && c.coluna !== "descartado";
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => aoAbrir(c.id)}
        className="glass painel-toque block w-full min-w-0 rounded-[14px] p-3 text-left hover:ring-1 hover:ring-ink/15"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <ChipDoTipo tipo={c.tipo} />
          <SeloDaPrioridade prioridade={c.prioridade} />
          {cruza ? (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
              style={{ color: COR_DO_TOM.atencao.texto, background: COR_DO_TOM.atencao.fundo }}
            >
              <TriangleAlert size={11} aria-hidden="true" />
              Cruza com {c.conflitos.map((k) => k.id).join(", ")}
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 block text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
          <span className="numeros text-muted">{c.id}.</span> {c.titulo}
        </span>
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Dono nome={c.responsavel} viaClaude={c.viaClaude} sessao={c.sessao} compacto />
          {c.ramo ? (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-muted">
              <GitBranch size={12} className="shrink-0" aria-hidden="true" />
              <span className="truncate font-mono text-[0.7rem]">{c.ramo}</span>
            </span>
          ) : null}
          {pr ? (
            <span className="inline-flex items-center gap-1 text-muted">
              <GitPullRequest size={12} aria-hidden="true" /> PR {pr}
            </span>
          ) : null}
          {c.caminhos.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-muted" title={c.caminhos.join("\n")}>
              <FolderTree size={12} aria-hidden="true" /> {c.caminhos.length} {c.caminhos.length === 1 ? "caminho" : "caminhos"}
            </span>
          ) : null}
        </span>
        {c.coluna === "no_ar" || c.coluna === "descartado" ? (
          <span className="mt-1.5 block text-[0.7rem] text-muted">
            {c.coluna === "no_ar" ? "No ar" : "Descartado"} em {quando(c.concluidoEm ?? c.mudouEm)}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Descartados: no celular é a última aba; no computador, uma lista que abre embaixo do quadro. */
function Descartados({ cartoes, ativa, aoAbrir }: { cartoes: Cartao[]; ativa: boolean; aoAbrir: (id: number) => void }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <div className={`${ativa ? "" : "hidden"} mt-3 xl:hidden`}>
        <ColunaDoQuadro coluna="descartado" cartoes={cartoes} ativa aoAbrir={aoAbrir} />
      </div>
      <div className="mt-6 hidden xl:block">
        <button type="button" aria-expanded={aberta} onClick={() => setAberta((v) => !v)} className="text-sm font-semibold text-muted hover:text-ink">
          {aberta ? "Esconder" : "Ver"} os descartados dos últimos 60 dias ({cartoes.length})
        </button>
        {aberta ? (
          cartoes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-5 gap-2.5">
              {cartoes.map((c) => (
                <CartaoNoQuadro key={c.id} c={c} aoAbrir={aoAbrir} />
              ))}
            </ul>
          )
        ) : null}
      </div>
    </>
  );
}

/**
 * As sugestões do time que ainda não foram para o quadro. "Levar para o
 * roadmap" cria o cartão ligado à sugestão; dali em diante o estado dela anda
 * com o cartão, e quem sugeriu acompanha em Time, Sugestões.
 */
function Entrada({ sugestoes, acoes, aoLevar }: { sugestoes: SugestaoNova[]; acoes: Acoes; aoLevar: (id: number) => void }) {
  const [aberta, setAberta] = useState(true);
  return (
    <div className="glass min-w-0 rounded-[16px] p-4">
      <button type="button" aria-expanded={aberta} onClick={() => setAberta((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <Inbox size={16} className="shrink-0" style={{ color: "var(--setor, #55606e)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
          {sugestoes.length === 1 ? "1 sugestão do time esperando" : `${sugestoes.length} sugestões do time esperando`}
        </span>
        <span className="text-xs text-muted">{aberta ? "Esconder" : "Ver"}</span>
      </button>
      {aberta ? (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {sugestoes.map((s) => (
            <SugestaoNaEntrada key={s.id} s={s} acoes={acoes} aoLevar={aoLevar} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SugestaoNaEntrada({ s, acoes, aoLevar }: { s: SugestaoNova; acoes: Acoes; aoLevar: (id: number) => void }) {
  const [levando, setLevando] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("melhoria");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [coluna, setColuna] = useState<"a_fazer" | "ideias">("a_fazer");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const levar = async () => {
    setSalvando(true);
    setErro(null);
    const r = await acoes.levar(s.id, { tipo, prioridade, coluna, titulo: "" }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    aoLevar(r.id);
  };

  return (
    <li className="min-w-0 rounded-[12px] border border-ink/[0.08] bg-white p-3">
      <p className="text-xs text-muted">
        <span className="font-semibold text-ink">{s.autor ?? "Alguém do time"}</span>, {quando(s.criadaEm)}
        {s.telaNome ? `, em ${s.telaNome}` : ""}
        {s.prints ? `, ${s.prints} ${s.prints === 1 ? "print" : "prints"}` : ""}
      </p>
      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{s.texto}</p>
      {levando ? (
        <form
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void levar();
          }}
        >
          <Selecao rotulo="Tipo" valor={tipo} aoMudar={(v) => setTipo(v as Tipo)} opcoes={TIPOS.map((t) => [t, NOME_DO_TIPO[t]])} />
          <Selecao rotulo="Prioridade" valor={prioridade} aoMudar={(v) => setPrioridade(v as Prioridade)} opcoes={PRIORIDADES.map((p) => [p, NOME_DA_PRIORIDADE[p]])} />
          <Selecao rotulo="Coluna" valor={coluna} aoMudar={(v) => setColuna(v as "a_fazer" | "ideias")} opcoes={[["a_fazer", "A fazer"], ["ideias", "Ideias"]]} />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60">
              {salvando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
              Levar
            </button>
            <button type="button" onClick={() => setLevando(false)} className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink">
              Cancelar
            </button>
            {erro ? <span role="alert" className="text-sm text-[#b91c1c]">{erro}</span> : null}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setLevando(true)}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/35"
        >
          <Plus size={13} aria-hidden="true" /> Levar para o roadmap
        </button>
      )}
    </li>
  );
}
