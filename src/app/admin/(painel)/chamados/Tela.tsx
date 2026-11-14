"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, CalendarClock, ImageIcon, Loader2, MessageSquare, Plus, Send, UserRound } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { COR_DO_TOM } from "@/lib/painel/tons";
import {
  NOME_DO_TIPO, SEM_FILTRO, SETORES_DO_CHAMADO, TIPOS,
  esperaDoChamado, filtrarChamados, limitesPorExtenso, oQueEsperaPorMim, ordenarChamados, paraQuem, piorEspera,
  type Chamado, type FiltroDeChamados, type SetorDoChamado, type TipoDeChamado,
} from "@/lib/time/chamados";
import type { Pessoa } from "@/lib/time/dados";
import { ROLE_LABEL, type AppRole } from "@/lib/auth/acessos";
import { ICONE_DO_TOM, SeloDeTom } from "../Pecas";
import { Ficha, FilaDeFichas, botaoCheio, botaoClaro, campo, diaEHora, useAgora, useAtualizarSozinho } from "../biblioteca/pecas";
import { CampoDeImagens, enviarImagens, useImagens, type Enviar, type ImagemEnviada } from "./Imagens";

/**
 * Chamados: pedir uma coisa a outro setor, com dono e relógio, sem virar outro
 * grupo de conversa.
 *
 * TRÊS REGRAS QUE NÃO SÃO ÓBVIAS:
 *
 * 1. Todo mundo vê todos os chamados. Ele substitui um grupo em que todos já
 *    veem tudo, e chamado escondido recriaria o "quem sabe disso?". Os filtros
 *    ("para o meu setor", "abertos por mim") só mudam o que está na frente.
 *
 * 2. Só o chamado ABERTO tem relógio, e o relógio tem cor: parado vira âmbar e
 *    depois vermelho, sempre com ícone e palavra. Os limites são premissa de
 *    partida (`LIMITES_DA_ESPERA`), e a tela diz isso por extenso no rodapé.
 *
 * 3. O print é COLADO. É como o time já pergunta hoje, e o campo de texto
 *    aceita a imagem da área de transferência.
 *
 * As ações vêm de fora, como propriedade, para a tela poder ser vista sem
 * sessão durante o desenvolvimento.
 */

export type Abrir = (p: {
  tipo: string;
  texto: string;
  paraSetor: string | null;
  paraPessoa: string | null;
  precisoAte: string | null;
  produto: string | null;
  imagens: ImagemEnviada[];
}) => Promise<{ ok: true; numero: number } | { ok: false; erro: string }>;

/** O que já vem preenchido quando o chamado nasce de outra tela (a consulta, a biblioteca). */
export type Novo = { tipo: TipoDeChamado | null; texto: string; produto: string | null; produtoNome: string | null };

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

function NovoChamado({
  novo, pessoas, meuId, abrir, enviar, onFechar,
}: {
  novo: Novo | null;
  pessoas: Pessoa[];
  meuId: string;
  abrir: Abrir;
  enviar: Enviar;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDeChamado | null>(novo?.tipo ?? null);
  const [setor, setSetor] = useState<SetorDoChamado | null>(null);
  const [pessoa, setPessoa] = useState("");
  const [paraPessoa, setParaPessoa] = useState(false);
  const [texto, setTexto] = useState(novo?.texto ?? "");
  const [precisoAte, setPrecisoAte] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, comecar] = useTransition();
  const imagens = useImagens();
  const outras = pessoas.filter((p) => p.id !== meuId);

  const enviarPedido = () => {
    if (!tipo) return setErro("Escolha o tipo do chamado.");
    if (paraPessoa ? !pessoa : !setor) return setErro("Escolha para quem vai: um setor ou uma pessoa.");
    if (texto.trim().length < 3) return setErro("Escreva o que você precisa.");
    setErro(null);
    comecar(async () => {
      const subidas = imagens.lista.length > 0 ? await enviar(meuId, imagens.lista) : { ok: true as const, imagens: [] };
      if (!subidas.ok) return setErro(subidas.erro);
      const feito = await abrir({
        tipo,
        texto,
        paraSetor: paraPessoa ? null : setor,
        paraPessoa: paraPessoa ? pessoa : null,
        precisoAte: precisoAte || null,
        produto: novo?.produto ?? null,
        imagens: subidas.imagens,
      });
      if (!feito.ok) return setErro(feito.erro);
      imagens.limpar();
      router.push(`/admin/chamados/${feito.numero}`);
    });
  };

  return (
    <section className="glass mt-4 rounded-[18px] p-4 sm:p-5" aria-label="Abrir chamado">
      <p className="text-sm font-semibold text-ink">Abrir chamado</p>
      {novo?.produtoNome ? <p className="mt-1 break-words text-xs text-muted">Sobre a peça: {novo.produtoNome}</p> : null}

      <form
        className="mt-3 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviarPedido();
        }}
      >
        <fieldset>
          <legend className="text-xs font-semibold text-ink">O que é</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <Ficha
                key={t.chave}
                ativa={tipo === t.chave}
                onClick={() => {
                  setTipo(t.chave);
                  setErro(null);
                }}
              >
                {t.nome}
              </Ficha>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold text-ink">Para quem vai</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SETORES_DO_CHAMADO.map((s) => {
              const ativo = !paraPessoa && setor === s.chave;
              return (
                <button
                  key={s.chave}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setParaPessoa(false);
                    setSetor(s.chave);
                    setErro(null);
                  }}
                  className={`painel-toque rounded-[12px] px-3 py-2 text-left ${ativo ? "painel-aba-ativa" : "border border-ink/12 bg-white"}`}
                >
                  <span className={`block text-sm font-semibold ${ativo ? "" : "text-ink"}`}>{s.nome}</span>
                  <span className={`block text-[0.68rem] leading-snug ${ativo ? "opacity-85" : "text-muted"}`}>{s.resolve}</span>
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={paraPessoa}
              onClick={() => setParaPessoa(true)}
              className={`painel-toque rounded-[12px] px-3 py-2 text-left ${paraPessoa ? "painel-aba-ativa" : "border border-ink/12 bg-white"}`}
            >
              <span className={`block text-sm font-semibold ${paraPessoa ? "" : "text-ink"}`}>Uma pessoa</span>
              <span className={`block text-[0.68rem] leading-snug ${paraPessoa ? "opacity-85" : "text-muted"}`}>Pelo nome</span>
            </button>
          </div>
          {paraPessoa ? (
            <label className="mt-2 block">
              <span className="sr-only">Escolher a pessoa</span>
              <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className={`${campo} h-12`}>
                <option value="">{outras.length === 0 ? "Nenhuma outra pessoa ativa no painel" : "Escolha a pessoa"}</option>
                {outras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({ROLE_LABEL[p.papel as AppRole] ?? p.papel})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>

        <label className="block">
          <span className="text-xs font-semibold text-ink">O que você precisa</span>
          <span className="block text-[0.7rem] text-muted">
            Já mande tudo o que a resposta depende: loja, modelo, numeração e para quando. Sem nome, telefone ou CPF de cliente.
          </span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPaste={imagens.aoColar}
            maxLength={4000}
            rows={5}
            className={campo}
          />
        </label>

        <CampoDeImagens imagens={imagens} ocupado={ocupado} />

        <label className="block">
          <span className="text-xs font-semibold text-ink">Preciso até</span>
          <span className="block text-[0.7rem] text-muted">Pode ficar vazio. Com data, o chamado avisa quando o prazo chega.</span>
          <input
            type="datetime-local"
            value={precisoAte}
            onChange={(e) => setPrecisoAte(e.target.value)}
            className={`${campo} numeros h-12 sm:max-w-xs`}
          />
        </label>

        {erro ? (
          <p role="alert" className="text-xs font-semibold text-[#b01919]">
            {erro}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={ocupado} className={botaoCheio}>
            {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            {ocupado ? "Enviando" : "Abrir chamado"}
          </button>
          <button type="button" disabled={ocupado} onClick={onFechar} className={botaoClaro}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

function CartaoDoChamado({ c, agora, meuId }: { c: Chamado; agora: number; meuId: string }) {
  const espera = esperaDoChamado(c, agora);
  return (
    <li>
      <LinkRapido href={`/admin/chamados/${c.numero}`} className="painel-toque glass block rounded-[16px] p-4 transition-shadow hover:shadow-md">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <SeloDeTom tom={espera.tom}>{espera.palavra}</SeloDeTom>
          <span className="numeros text-xs text-muted">Chamado {c.numero}</span>
        </span>
        <span className="mt-2 block text-[0.72rem] leading-snug text-muted">
          <span className="painel-cor font-bold uppercase tracking-wider">{NOME_DO_TIPO[c.tipo]}</span>
          {" · "}para <span className="font-semibold text-ink">{paraQuem(c)}</span>
          {" · "}de {c.abertoPor === meuId ? "você" : (c.abertoPorNome ?? "alguém do time")}
        </span>
        <span className="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-sm font-medium leading-snug text-ink">{c.texto}</span>
        {c.ultima ? (
          <span className="mt-2 block rounded-[10px] bg-ink/[0.04] px-2.5 py-1.5 text-xs leading-snug text-ink/80">
            <span className="font-semibold text-ink">{c.ultima.autor ?? "Alguém"}:</span>{" "}
            <span className="line-clamp-2 inline break-words">{c.ultima.texto || "mandou uma imagem"}</span>
          </span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted">
          <span className="numeros">{diaEHora(c.criadoEm)}</span>
          {c.mensagens > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={11} aria-hidden="true" /> {plural(c.mensagens, "mensagem", "mensagens")}
            </span>
          ) : null}
          {c.anexos > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ImageIcon size={11} aria-hidden="true" /> {plural(c.anexos, "imagem", "imagens")}
            </span>
          ) : null}
          {c.precisoAte && c.estado !== "resolvido" ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={11} aria-hidden="true" /> preciso até {diaEHora(c.precisoAte)}
            </span>
          ) : null}
          {c.naBiblioteca ? (
            <span className="inline-flex items-center gap-1">
              <BookCheck size={11} aria-hidden="true" /> virou resposta da biblioteca
            </span>
          ) : null}
        </span>
      </LinkRapido>
    </li>
  );
}

export function TelaDosChamados({
  chamados, meuId, meusSetores, pessoas, agora: agoraDoServidor, novo, abrir, enviar = enviarImagens,
}: {
  chamados: Chamado[] | null;
  meuId: string;
  meusSetores: SetorDoChamado[];
  pessoas: Pessoa[];
  /** O instante em que o servidor montou a página, para o relógio do navegador começar igual. */
  agora: string;
  /** Quando a pessoa chega de outra tela para abrir um chamado. */
  novo: Novo | null;
  abrir: Abrir;
  /** Só a prévia de desenvolvimento troca: lá não há sessão para subir imagem. */
  enviar?: Enviar;
}) {
  const agora = useAgora(agoraDoServidor);
  const [abrindo, setAbrindo] = useState(novo !== null);
  const [filtro, setFiltro] = useState<FiltroDeChamados>(SEM_FILTRO);
  // Com o formulário aberto a tela não se atualiza sozinha: a pessoa está escrevendo.
  useAtualizarSozinho(45_000, abrindo);

  const eu = useMemo(() => ({ id: meuId, setores: meusSetores }), [meuId, meusSetores]);
  const lista = useMemo(() => chamados ?? [], [chamados]);
  const meu = useMemo(() => oQueEsperaPorMim(lista, eu), [lista, eu]);
  const visiveis = useMemo(() => ordenarChamados(filtrarChamados(lista, filtro, eu), agora), [lista, filtro, eu, agora]);
  const emAndamento = lista.filter((c) => c.estado !== "resolvido").length;
  const resolvidos = lista.length - emAndamento;
  const paraMim = filtrarChamados(lista, { ...SEM_FILTRO, quem: "para_mim" }, eu).length;
  const abertosPorMim = filtrarChamados(lista, { ...SEM_FILTRO, quem: "meus" }, eu).length;
  const pior = piorEspera(meu.paraResponder, agora);
  const IconeDaEspera = pior ? ICONE_DO_TOM[pior.tom] : null;

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Time</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Chamados</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
            Peça uma coisa a outro setor. Todo mundo vê, e cada chamado tem para quem vai e há quanto tempo espera.
          </p>
        </div>
        {!abrindo ? (
          <button type="button" onClick={() => setAbrindo(true)} className={botaoCheio}>
            <Plus size={14} aria-hidden="true" /> Abrir chamado
          </button>
        ) : null}
      </header>

      {abrindo ? <NovoChamado novo={novo} pessoas={pessoas} meuId={meuId} abrir={abrir} enviar={enviar} onFechar={() => setAbrindo(false)} /> : null}

      {meu.paraResponder.length > 0 || meu.respondidos.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {meu.paraResponder.length > 0 && pior ? (
            <button
              type="button"
              onClick={() => setFiltro({ ...SEM_FILTRO, quem: "para_mim" })}
              className="painel-toque rounded-[14px] p-3.5 text-left"
              style={
                pior.tom === "neutro"
                  ? { background: "#fff", border: "1px solid rgb(23 21 18 / 0.1)" }
                  : { background: COR_DO_TOM[pior.tom].fundo, color: COR_DO_TOM[pior.tom].texto }
              }
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                {IconeDaEspera ? <IconeDaEspera size={15} aria-hidden="true" /> : <UserRound size={15} aria-hidden="true" />}
                {meu.paraResponder.length === 1 ? "1 chamado espera a sua resposta" : `${meu.paraResponder.length} chamados esperam a sua resposta`}
              </span>
              <span className="mt-0.5 block text-xs opacity-90">O que mais espera: {pior.palavra.toLowerCase()}. Toque para ver só os seus.</span>
            </button>
          ) : null}
          {meu.respondidos.length > 0 ? (
            <button
              type="button"
              onClick={() => setFiltro({ ...SEM_FILTRO, quem: "meus" })}
              className="painel-toque rounded-[14px] p-3.5 text-left"
              style={{ background: COR_DO_TOM.bom.fundo, color: COR_DO_TOM.bom.texto }}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <MessageSquare size={15} aria-hidden="true" />
                {meu.respondidos.length === 1 ? "1 chamado seu foi respondido" : `${meu.respondidos.length} chamados seus foram respondidos`}
              </span>
              <span className="mt-0.5 block text-xs opacity-90">Leia a resposta e marque como resolvido, ou pergunte de novo.</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {chamados === null ? (
        <p className="glass mt-5 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler os chamados agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-2">
            <FilaDeFichas rotulo="Filtrar por quem">
              <Ficha ativa={!filtro.resolvidos && filtro.quem === "todos"} onClick={() => setFiltro({ ...filtro, quem: "todos", resolvidos: false })} contagem={emAndamento}>
                Em andamento
              </Ficha>
              <Ficha ativa={!filtro.resolvidos && filtro.quem === "para_mim"} onClick={() => setFiltro({ ...filtro, quem: "para_mim", resolvidos: false })} contagem={paraMim}>
                {meusSetores.length > 0 ? "Para o meu setor" : "Para mim"}
              </Ficha>
              <Ficha ativa={!filtro.resolvidos && filtro.quem === "meus"} onClick={() => setFiltro({ ...filtro, quem: "meus", resolvidos: false })} contagem={abertosPorMim}>
                Abertos por mim
              </Ficha>
              <Ficha ativa={filtro.resolvidos} onClick={() => setFiltro({ ...filtro, quem: "todos", resolvidos: !filtro.resolvidos })} contagem={resolvidos}>
                Resolvidos
              </Ficha>
            </FilaDeFichas>
            <FilaDeFichas rotulo="Filtrar por tipo">
              <Ficha ativa={filtro.tipo === "todos"} onClick={() => setFiltro({ ...filtro, tipo: "todos" })}>
                Todos os tipos
              </Ficha>
              {TIPOS.map((t) => (
                <Ficha key={t.chave} ativa={filtro.tipo === t.chave} onClick={() => setFiltro({ ...filtro, tipo: filtro.tipo === t.chave ? "todos" : t.chave })}>
                  {t.curto}
                </Ficha>
              ))}
            </FilaDeFichas>
          </div>

          <p className="mt-3 text-xs text-muted" aria-live="polite">
            {visiveis.length === 0
              ? lista.length === 0
                ? "Nenhum chamado ainda."
                : "Nenhum chamado com esse filtro."
              : filtro.resolvidos
                ? `${plural(visiveis.length, "chamado resolvido", "chamados resolvidos")} nos últimos 30 dias.`
                : `${plural(visiveis.length, "chamado", "chamados")}. O que espera há mais tempo vem primeiro.`}
          </p>

          {visiveis.length > 0 ? (
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {visiveis.map((c) => (
                <CartaoDoChamado key={c.id} c={c} agora={agora} meuId={meuId} />
              ))}
            </ul>
          ) : lista.length === 0 ? (
            <div className="glass mt-3 rounded-[16px] p-5">
              <p className="text-sm font-semibold text-ink">Ainda não há chamado nenhum.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Use quando a resposta depende de outra pessoa: um orçamento de peça personalizada, o estoque de uma loja, um prazo. O chamado
                chega no setor certo e fica à vista de todos até ser resolvido.
              </p>
            </div>
          ) : null}

          <p className="mt-6 text-[0.7rem] leading-relaxed text-muted">
            <span className="font-semibold text-ink/70">As cores da espera são de partida.</span> {limitesPorExtenso()} O relógio é corrido:
            conta a noite e o fim de semana. A JK ainda não disse o prazo de resposta que quer, e quando disser é trocar um número.
          </p>
        </>
      )}
    </div>
  );
}
