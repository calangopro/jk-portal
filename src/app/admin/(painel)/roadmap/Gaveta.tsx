"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, CircleAlert, Copy, GitBranch, GitPullRequest, Lightbulb, Loader2 } from "lucide-react";
import {
  COLUNAS, EM_TRABALHO, NOME_DA_COLUNA, NOME_DA_PRIORIDADE, NOME_DO_TIPO, PRIORIDADES, TETO_DA_DESCRICAO, TETO_DA_NOTA, TETO_DO_TITULO, TIPOS,
  lerCaminhos, movimentoEmPalavras, numeroDoPr, prValido, ramoSugerido, ramoValido,
  type Cartao, type CartaoInteiro, type Coluna, type Conflito, type Pessoa, type Prioridade, type Tipo,
} from "@/lib/roadmap/roadmap";
import { NOME_DO_ESTADO, ehEstado } from "@/lib/sugestoes/sugestoes";
import { Janela } from "./Janela";
import { ChipDoTipo, Dono, ListaDeCruzamentos, SeloDaPrioridade, Selecao, quando } from "./pecas";
import type { Acoes } from "./tipos";

type Eu = { id: string; nome: string };
type Estado = { fase: "lendo" } | { fase: "erro"; erro: string } | { fase: "pronto"; inteiro: CartaoInteiro };

/** A gaveta de um cartão: o que ele é, quem faz, onde, e o que dá para fazer com ele. */
export function GavetaDoCartao({ id, eu, pessoas, acoes, aoFechar }: { id: number; eu: Eu; pessoas: Pessoa[]; acoes: Acoes; aoFechar: () => void }) {
  const [estado, setEstado] = useState<Estado>({ fase: "lendo" });

  const carregar = useCallback(async () => {
    const r = await acoes.ver(id).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setEstado(r.ok ? { fase: "pronto", inteiro: r.inteiro } : { fase: "erro", erro: r.erro });
  }, [acoes, id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Janela titulo={`Cartão ${id}`} aoFechar={aoFechar} lateral>
      {estado.fase === "lendo" ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Lendo o cartão
        </p>
      ) : estado.fase === "erro" ? (
        <p role="alert" className="text-sm text-[#b91c1c]">{estado.erro}</p>
      ) : (
        <Conteudo inteiro={estado.inteiro} eu={eu} pessoas={pessoas} acoes={acoes} aoMudar={carregar} />
      )}
    </Janela>
  );
}

function Conteudo({ inteiro, eu, pessoas, acoes, aoMudar }: { inteiro: CartaoInteiro; eu: Eu; pessoas: Pessoa[]; acoes: Acoes; aoMudar: () => Promise<void> }) {
  const c = inteiro.cartao;
  const concluido = c.coluna === "no_ar" || c.coluna === "descartado";
  const pr = numeroDoPr(c.prUrl);

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipDoTipo tipo={c.tipo} />
          <SeloDaPrioridade prioridade={c.prioridade} sempre />
          <span className="rounded-full px-2 py-0.5 text-[0.68rem] font-bold text-white" style={{ background: "var(--setor, #55606e)" }}>
            {NOME_DA_COLUNA[c.coluna]}
          </span>
        </div>
        <h3 className="font-display mt-2 text-2xl leading-tight text-ink [overflow-wrap:anywhere]">{c.titulo}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Dono nome={c.responsavel} viaClaude={c.viaClaude} sessao={c.sessao} />
          {c.pegouEm && c.responsavel ? <span className="text-xs text-muted">desde {quando(c.pegouEm)}</span> : null}
        </p>
        {c.viaClaude && c.sessao ? (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted [overflow-wrap:anywhere]">
            <Bot size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> Sessão: {c.sessao}
          </p>
        ) : null}
        {c.ultimaNota ? (
          <p className="mt-2 rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm text-ink [overflow-wrap:anywhere]">
            <span className="font-semibold">Nota: </span>
            {c.ultimaNota}
          </p>
        ) : null}
      </section>

      {!concluido ? (
        <ListaDeCruzamentos
          conflitos={c.conflitos}
          titulo={EM_TRABALHO.includes(c.coluna) ? "Outro trabalho mexe no mesmo lugar. Combinem quem junta primeiro." : "Se pegar agora, cruza com um trabalho em andamento."}
        />
      ) : null}

      {c.descricao ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{c.descricao}</p> : null}

      {c.ramo || c.prUrl || c.caminhos.length > 0 ? (
        <section className="glass min-w-0 rounded-[14px] p-3.5 text-sm">
          {c.ramo ? (
            <div className="flex min-w-0 items-center gap-2">
              <GitBranch size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{c.ramo}</code>
              <Copiar valor={`git switch -c ${c.ramo}`} rotulo="Copiar o comando" />
            </div>
          ) : null}
          {c.prUrl ? (
            <a href={c.prUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 font-semibold text-brand-nav underline decoration-brand-nav/30 underline-offset-2 hover:decoration-brand-nav">
              <GitPullRequest size={14} aria-hidden="true" /> Pedido de revisão {pr}
            </a>
          ) : null}
          {c.caminhos.length > 0 ? (
            <div className="mt-2.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">Onde mexe</p>
              <ul className="mt-1 grid grid-cols-1 gap-0.5">
                {c.caminhos.map((x) => (
                  <li key={x} className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {concluido ? (
        <p className="text-sm text-muted">Para trabalhar de novo neste cartão, mova ele para A fazer.</p>
      ) : (
        <Bloco titulo={EM_TRABALHO.includes(c.coluna) ? "Quem faz e onde" : "Pegar o cartão"}>
          <FormularioDePegar c={c} eu={eu} pessoas={pessoas} acoes={acoes} aoMudar={aoMudar} />
        </Bloco>
      )}

      <Bloco titulo="Mover">
        <FormularioDeMover c={c} acoes={acoes} aoMudar={aoMudar} />
      </Bloco>

      {!concluido || c.prUrl ? (
        <Bloco titulo="Pedido de revisão">
          <FormularioDoPr c={c} acoes={acoes} aoMudar={aoMudar} />
        </Bloco>
      ) : null}

      <details className="group min-w-0">
        <summary className="cursor-pointer text-sm font-bold text-ink">Editar o título, o tipo e os detalhes</summary>
        <div className="mt-3">
          <FormularioDeEditar c={c} acoes={acoes} aoMudar={aoMudar} />
        </div>
      </details>

      {inteiro.sugestao ? (
        <section className="min-w-0 rounded-[14px] border border-ink/[0.08] bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
            <Lightbulb size={12} aria-hidden="true" /> Veio de uma sugestão do time
          </p>
          <p className="mt-1.5 text-xs text-muted">
            <span className="font-semibold text-ink">{inteiro.sugestao.autor ?? "Alguém do time"}</span>
            {inteiro.sugestao.telaNome ? `, na tela ${inteiro.sugestao.telaNome}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{inteiro.sugestao.texto}</p>
          <p className="mt-2 text-xs text-muted">
            Para quem sugeriu, ela está como <span className="font-semibold text-ink">{ehEstado(inteiro.sugestao.estado) ? NOME_DO_ESTADO[inteiro.sugestao.estado] : inteiro.sugestao.estado}</span>
            {inteiro.sugestao.resposta ? `, com a resposta: "${inteiro.sugestao.resposta}"` : ""}. Ela anda sozinha quando o cartão muda de coluna.
          </p>
          <Link href="/admin/sugestoes" className="mt-1.5 inline-block text-xs font-semibold text-brand-nav underline decoration-brand-nav/30 underline-offset-2">
            Ver em Sugestões
          </Link>
        </section>
      ) : null}

      <section className="min-w-0">
        <h4 className="text-sm font-bold text-ink">Histórico</h4>
        {inteiro.historico.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted">Nada ainda.</p>
        ) : (
          <ol className="mt-2 grid grid-cols-1 gap-2 border-l border-ink/10 pl-3">
            {inteiro.historico.map((h, i) => (
              <li key={`${h.em}-${i}`} className="min-w-0 text-sm">
                <p className="text-ink">
                  <span className="font-semibold">{h.por ?? "Alguém"}</span> {movimentoEmPalavras(h).replace(/^./, (l) => l.toLowerCase())}
                  {h.peloConector ? (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted">
                      <Bot size={11} aria-hidden="true" /> pelo Claude
                    </span>
                  ) : null}
                </p>
                <p className="numeros text-xs text-muted">{quando(h.em)}</p>
                {h.nota ? <p className="mt-0.5 text-xs text-ink [overflow-wrap:anywhere]">{h.nota}</p> : null}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-muted">
          Criado em {quando(c.criadoEm)}
          {c.criadoPor ? ` por ${c.criadoPor}` : ""}
          {c.referencia ? `, referência ${c.referencia}` : ""}.
        </p>
      </section>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-ink/[0.08] bg-white p-3.5">
      <h4 className="text-sm font-bold text-ink">{titulo}</h4>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Aviso({ texto, ok = false }: { texto: string | null; ok?: boolean }) {
  if (!texto) return null;
  return (
    <span role={ok ? "status" : "alert"} className="inline-flex items-start gap-1.5 text-sm" style={{ color: ok ? "#047857" : "#b91c1c" }}>
      {ok ? <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <span>{texto}</span>
    </span>
  );
}

function BotaoDeSalvar({ salvando, desligado = false, children }: { salvando: boolean; desligado?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={salvando || desligado} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-50">
      {salvando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

const campo = "mt-1 w-full rounded-[10px] border border-border bg-white px-2.5 py-2 text-sm text-ink placeholder:text-muted";
const rotulo = "text-[0.7rem] font-semibold uppercase tracking-wider text-muted";

/**
 * Pegar: quem faz, o ramo, onde vai mexer e (se for o Claude) qual sessão. Os
 * caminhos são conferidos enquanto a pessoa escreve, e o cruzamento aparece
 * antes de salvar. Cartão que está com outra pessoa pede uma segunda
 * confirmação ("Assumir mesmo assim"), por isso o envio é por `onSubmit`.
 */
function FormularioDePegar({ c, eu, pessoas, acoes, aoMudar }: { c: Cartao; eu: Eu; pessoas: Pessoa[]; acoes: Acoes; aoMudar: () => Promise<void> }) {
  const emTrabalho = EM_TRABALHO.includes(c.coluna);
  const [responsavel, setResponsavel] = useState(c.responsavelId ?? eu.id);
  const nomeDe = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? (id === eu.id ? eu.nome : null);
  const [ramo, setRamo] = useState(c.ramo ?? ramoSugerido(nomeDe(c.responsavelId ?? eu.id), c.id, c.titulo));
  const ramoMexido = useRef(Boolean(c.ramo));
  const [caminhos, setCaminhos] = useState(c.caminhos.join("\n"));
  const [sessao, setSessao] = useState(c.sessao ?? "");
  const [cruzam, setCruzam] = useState<Conflito[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [comOutra, setComOutra] = useState<string | null>(null);

  // Troca de dono muda o ramo sugerido, enquanto a pessoa não escreveu um ramo dela.
  useEffect(() => {
    if (!ramoMexido.current) setRamo(ramoSugerido(nomeDe(responsavel), c.id, c.titulo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsavel]);

  // Confere os caminhos meio segundo depois da última tecla.
  useEffect(() => {
    const lista = lerCaminhos(caminhos);
    if (lista.length === 0) {
      setCruzam([]);
      return;
    }
    let vale = true;
    setConferindo(true);
    const t = setTimeout(async () => {
      const r = await acoes.conferir(lista, c.id).catch(() => null);
      if (!vale) return;
      setConferindo(false);
      if (r?.ok) setCruzam(r.conflitos);
    }, 500);
    return () => {
      vale = false;
      clearTimeout(t);
    };
  }, [caminhos, acoes, c.id]);

  const pegar = async (tomar: boolean) => {
    const r = ramo.trim();
    if (r && !ramoValido(r)) {
      setAviso({ ok: false, texto: "O ramo só aceita letras, números, ponto, hífen, sublinhado e barra." });
      return;
    }
    setSalvando(true);
    setAviso(null);
    setComOutra(null);
    const resposta = await acoes
      .pegar(c.id, { caminhos: lerCaminhos(caminhos), ramo: r, sessao, responsavel: responsavel === eu.id ? null : responsavel, tomar })
      .catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo.", motivo: undefined, de: undefined }));
    setSalvando(false);
    if (!resposta.ok) {
      if (resposta.motivo === "com_outra_pessoa") {
        setComOutra(resposta.de ?? "outra pessoa");
        return;
      }
      setAviso({ ok: false, texto: resposta.erro });
      return;
    }
    setAviso({ ok: true, texto: resposta.conflitos.length ? "Salvo, com aviso de cruzamento" : "Salvo" });
    await aoMudar();
  };

  const semCaminho = lerCaminhos(caminhos).length === 0;

  return (
    <form
      className="grid grid-cols-1 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void pegar(false);
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Selecao rotulo="Quem faz" valor={responsavel} aoMudar={setResponsavel} opcoes={pessoas.map((p) => [p.id, p.id === eu.id ? `${p.nome} (você)` : p.nome])} />
        <label className="block min-w-0">
          <span className={rotulo}>Ramo do git</span>
          <input
            value={ramo}
            onChange={(e) => {
              ramoMexido.current = true;
              setRamo(e.target.value);
            }}
            spellCheck={false}
            maxLength={200}
            className={`${campo} font-mono text-xs`}
          />
        </label>
      </div>
      <label className="block min-w-0">
        <span className={rotulo}>Onde vai mexer (um por linha)</span>
        <textarea
          value={caminhos}
          onChange={(e) => setCaminhos(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={"src/lib/redes\n/admin/vendas\nsupabase/migrations/0150_nome.sql"}
          className={`${campo} resize-y font-mono text-xs leading-relaxed`}
        />
        <span className="mt-1 block text-xs text-muted">
          Pastas, arquivos ou telas do painel (a tela vale como a pasta dela). {conferindo ? "Conferindo..." : semCaminho ? "Sem caminhos, o quadro não consegue avisar quem for mexer no mesmo lugar." : ""}
        </span>
      </label>
      <ListaDeCruzamentos conflitos={cruzam} titulo="Esses caminhos cruzam com trabalho em andamento" />
      <label className="block min-w-0">
        <span className={rotulo}>Sessão do Claude (opcional)</span>
        <input value={sessao} onChange={(e) => setSessao(e.target.value)} maxLength={160} placeholder="Ex.: Claude Code do Erick, sessão do chat privado" className={campo} />
        <span className="mt-1 block text-xs text-muted">Preencha quando quem vai mexer é o Claude: o cartão aparece como &quot;pelo Claude&quot;.</span>
      </label>

      {comOutra ? (
        <div role="alert" className="rounded-[10px] bg-[#fcefd9] px-3 py-2.5 text-sm text-[#9a4a07]">
          <p>
            Este cartão está com <span className="font-semibold">{comOutra}</span>. Assumir tira dele: combine antes.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void pegar(true)} disabled={salvando} className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60">
              Assumir mesmo assim
            </button>
            <button type="button" onClick={() => setComOutra(null)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink/80 hover:text-ink">
              Deixar com {comOutra.split(" ")[0]}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <BotaoDeSalvar salvando={salvando}>{emTrabalho ? "Salvar" : "Pegar e mover para Fazendo"}</BotaoDeSalvar>
        <Aviso texto={aviso?.texto ?? null} ok={aviso?.ok} />
      </div>
    </form>
  );
}

/** Mover entre as colunas. Descartar pede o motivo. A nota é o que quem sugeriu lê, se o cartão veio de uma sugestão. */
function FormularioDeMover({ c, acoes, aoMudar }: { c: Cartao; acoes: Acoes; aoMudar: () => Promise<void> }) {
  const [coluna, setColuna] = useState<Coluna>(c.coluna);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const mover = async () => {
    if (coluna === "descartado" && nota.trim().length < 3) {
      setAviso({ ok: false, texto: "Para descartar, escreva o motivo na nota." });
      return;
    }
    setSalvando(true);
    setAviso(null);
    const r = await acoes.mover(c.id, coluna, nota).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.erro });
      return;
    }
    setNota("");
    setAviso({ ok: true, texto: `Movido para ${NOME_DA_COLUNA[coluna]}` });
    await aoMudar();
  };

  return (
    <form
      className="grid grid-cols-1 gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void mover();
      }}
    >
      <Selecao rotulo="Coluna" valor={coluna} aoMudar={(v) => setColuna(v as Coluna)} opcoes={COLUNAS.map((k) => [k, k === c.coluna ? `${NOME_DA_COLUNA[k]} (agora)` : NOME_DA_COLUNA[k]])} />
      <label className="block min-w-0">
        <span className={rotulo}>{coluna === "descartado" ? "Motivo" : "Nota (opcional)"}</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          maxLength={TETO_DA_NOTA}
          placeholder={coluna === "no_ar" ? "Ex.: entrou no ar com o pedido de revisão 150." : coluna === "descartado" ? "Por que não vai entrar." : ""}
          className={`${campo} resize-y`}
        />
        {c.sugestaoId ? <span className="mt-1 block text-xs text-muted">Este cartão veio de uma sugestão: quem sugeriu lê esta nota em Time, Sugestões.</span> : null}
        {coluna === "ideias" || coluna === "a_fazer" ? (
          EM_TRABALHO.includes(c.coluna) ? <span className="mt-1 block text-xs text-muted">Voltar para {NOME_DA_COLUNA[coluna]} solta o cartão: ele fica sem dono.</span> : null
        ) : null}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <BotaoDeSalvar salvando={salvando} desligado={coluna === c.coluna}>Mover</BotaoDeSalvar>
        <Aviso texto={aviso?.texto ?? null} ok={aviso?.ok} />
      </div>
    </form>
  );
}

function FormularioDoPr({ c, acoes, aoMudar }: { c: Cartao; acoes: Acoes; aoMudar: () => Promise<void> }) {
  const [pr, setPr] = useState(c.prUrl ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const vaiParaRevisao = c.coluna === "ideias" || c.coluna === "a_fazer" || c.coluna === "fazendo";

  const ligar = async () => {
    if (!prValido(pr.trim())) {
      setAviso({ ok: false, texto: "Cole o endereço do pedido de revisão do GitHub (https://github.com/.../pull/123)." });
      return;
    }
    setSalvando(true);
    setAviso(null);
    const r = await acoes.ligarPr(c.id, pr, c.ramo ?? "").catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.erro });
      return;
    }
    setAviso({ ok: true, texto: vaiParaRevisao ? "Ligado. O cartão foi para Em revisão." : "Ligado" });
    await aoMudar();
  };

  return (
    <form
      className="grid grid-cols-1 gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void ligar();
      }}
    >
      <input
        value={pr}
        onChange={(e) => setPr(e.target.value)}
        type="url"
        inputMode="url"
        spellCheck={false}
        placeholder="https://github.com/calangopro/jk-portal/pull/150"
        aria-label="Endereço do pedido de revisão"
        className={`${campo} mt-0 font-mono text-xs`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <BotaoDeSalvar salvando={salvando} desligado={pr.trim() === (c.prUrl ?? "")}>{vaiParaRevisao ? "Ligar e mover para Em revisão" : "Ligar"}</BotaoDeSalvar>
        <Aviso texto={aviso?.texto ?? null} ok={aviso?.ok} />
      </div>
    </form>
  );
}

function FormularioDeEditar({ c, acoes, aoMudar }: { c: Cartao; acoes: Acoes; aoMudar: () => Promise<void> }) {
  const [titulo, setTitulo] = useState(c.titulo);
  const [descricao, setDescricao] = useState(c.descricao ?? "");
  const [tipo, setTipo] = useState<Tipo>(c.tipo);
  const [prioridade, setPrioridade] = useState<Prioridade>(c.prioridade);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const campos = {
    ...(titulo.trim() !== c.titulo ? { titulo } : {}),
    ...(descricao.trim() !== (c.descricao ?? "") ? { descricao } : {}),
    ...(tipo !== c.tipo ? { tipo } : {}),
    ...(prioridade !== c.prioridade ? { prioridade } : {}),
  };
  const mudou = Object.keys(campos).length > 0;

  const salvar = async () => {
    setSalvando(true);
    setAviso(null);
    const r = await acoes.editar(c.id, campos).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.erro });
      return;
    }
    setAviso({ ok: true, texto: "Salvo" });
    await aoMudar();
  };

  return (
    <form
      className="grid grid-cols-1 gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <label className="block min-w-0">
        <span className={rotulo}>Título</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={TETO_DO_TITULO} className={campo} />
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Selecao rotulo="Tipo" valor={tipo} aoMudar={(v) => setTipo(v as Tipo)} opcoes={TIPOS.map((t) => [t, NOME_DO_TIPO[t]])} />
        <Selecao rotulo="Prioridade" valor={prioridade} aoMudar={(v) => setPrioridade(v as Prioridade)} opcoes={PRIORIDADES.map((p) => [p, NOME_DA_PRIORIDADE[p]])} />
      </div>
      <label className="block min-w-0">
        <span className={rotulo}>Detalhes</span>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5} maxLength={TETO_DA_DESCRICAO} className={`${campo} resize-y leading-relaxed`} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <BotaoDeSalvar salvando={salvando} desligado={!mudou}>Salvar</BotaoDeSalvar>
        <Aviso texto={aviso?.texto ?? null} ok={aviso?.ok} />
      </div>
    </form>
  );
}

function Copiar({ valor, rotulo: nome }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(valor).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        });
      }}
      title={valor}
      className="painel-toque inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-semibold text-ink hover:border-ink/35"
    >
      {copiado ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copiado ? "Copiado" : nome}
    </button>
  );
}
