"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, Loader2, MessagesSquare, Pencil, Plus, Search, TriangleAlert, Undo2, X } from "lucide-react";
import {
  NOME_DO_TEMA, TEMAS, contarPorTema, estadoEmPalavra, filtrarRespostas, oQuePode, respostasProximas,
  type Estado, type RascunhoDeResposta, type Resposta, type Tema,
} from "@/lib/time/biblioteca";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { SeloDeTom } from "../Pecas";
import { FormularioDeResposta } from "./FormularioDeResposta";
import { Copiar, Ficha, FilaDeFichas, botaoCheio, botaoClaro, dia, type Feito } from "./pecas";

/**
 * A Biblioteca JK: as respostas da casa, para achar em segundos e colar na
 * conversa com o cliente.
 *
 * DESENHADA PARA O CELULAR NA MÃO, NO MEIO DE UM ATENDIMENTO. A biblioteca
 * inteira vem de uma vez e a busca roda no navegador, a cada letra. Cada
 * resposta mostra a pergunta, a explicação para quem atende e a frase pronta,
 * com o botão de copiar ao lado.
 *
 * A REGRA QUE NÃO É ÓBVIA: resposta "a confirmar" APARECE. Esconder deixaria o
 * vendedor sem nada na mão e de volta ao grupo; mostrar sem aviso faria ele
 * prometer regra que a JK não assinou. Então ela aparece em âmbar, com ícone,
 * palavra e o aviso por extenso, e a diretoria confirma com um toque.
 *
 * As ações vêm de fora, como propriedade, para a tela poder ser vista sem
 * sessão durante o desenvolvimento.
 */

export type Sugerir = (r: RascunhoDeResposta) => Promise<Feito>;
export type Editar = (id: string, r: RascunhoDeResposta) => Promise<Feito>;
export type DefinirEstado = (id: string, estado: Estado) => Promise<Feito>;

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

function CartaoDaResposta({
  r, admin, meuId, destaque, editar, definirEstado,
}: {
  r: Resposta;
  admin: boolean;
  meuId: string;
  destaque: boolean;
  editar: Editar;
  definirEstado?: DefinirEstado;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, comecar] = useTransition();
  const caixa = useRef<HTMLLIElement>(null);

  const estado = estadoEmPalavra(r.estado);
  // A mesma regra do banco, só para a tela não oferecer botão que seria recusado.
  const pode = oQuePode({ admin: admin && Boolean(definirEstado), souAutor: r.criadoPor === meuId, estado: r.estado });
  const podeEditar = pode.editar;

  // Quem chega pelo link de um chamado cai em cima da resposta dele.
  useEffect(() => {
    if (destaque) caixa.current?.scrollIntoView({ block: "center" });
  }, [destaque]);

  const mudarEstado = (para: Estado) =>
    comecar(async () => {
      if (!definirEstado) return;
      setErro(null);
      const feito = await definirEstado(r.id, para);
      if (feito.ok) {
        setArquivando(false);
        router.refresh();
      } else setErro(feito.erro);
    });

  return (
    <li ref={caixa} className={`glass rounded-[16px] p-4 sm:p-5 ${destaque ? "outline outline-2 outline-[var(--setor)]" : ""}`}>
      {editando ? (
        <>
          <p className="mb-3 text-sm font-semibold text-ink">Editar a resposta</p>
          <FormularioDeResposta
            inicial={{ tema: r.tema, pergunta: r.pergunta, explicacao: r.explicacao, frase: r.frase ?? "", origem: r.origem ?? "" }}
            rotuloDoBotao={r.estado === "confirmada" ? "Salvar e manter confirmada" : "Salvar"}
            aviso={
              r.estado === "confirmada" ? (
                <p className="text-xs leading-relaxed text-muted">
                  Esta resposta já está confirmada. Salvar confirma o texto novo no seu nome, e o texto de antes fica guardado no histórico.
                </p>
              ) : undefined
            }
            onSalvar={async (novo) => {
              const feito = await editar(r.id, novo);
              if (feito.ok) {
                setEditando(false);
                router.refresh();
              }
              return feito;
            }}
            onCancelar={() => setEditando(false)}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="painel-cor text-[0.68rem] font-bold uppercase tracking-wider">{NOME_DO_TEMA[r.tema]}</p>
            <SeloDeTom tom={estado.tom}>{estado.palavra}</SeloDeTom>
          </div>
          <h2 className="mt-1.5 break-words text-base font-bold leading-snug text-ink sm:text-[1.05rem]">{r.pergunta}</h2>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink/85">{r.explicacao}</p>

          {r.frase ? (
            <div className="mt-3 rounded-[12px] border border-ink/10 bg-white p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Para mandar ao cliente</p>
              <p className="mt-1 whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-ink">{r.frase}</p>
              <div className="mt-2.5">
                <Copiar texto={r.frase} cheio>
                  Copiar a frase
                </Copiar>
              </div>
            </div>
          ) : null}

          {estado.aviso ? (
            <p
              className="mt-3 flex items-start gap-1.5 text-xs font-semibold leading-relaxed"
              style={r.estado === "a_confirmar" ? { color: COR_DO_TOM.atencao.texto } : undefined}
            >
              {r.estado === "a_confirmar" ? <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> : null}
              <span className={r.estado === "a_confirmar" ? "" : "text-muted"}>{estado.aviso}</span>
            </p>
          ) : null}

          <p className="mt-3 break-words text-[0.7rem] leading-relaxed text-muted">
            {r.estado === "confirmada" && r.confirmadoEm
              ? `Confirmada${r.confirmadoPorNome ? ` por ${r.confirmadoPorNome}` : ""} em ${dia(r.confirmadoEm)}. `
              : null}
            {r.origem ? `De onde veio: ${r.origem}. ` : null}
            {r.criadoPorNome ? `Sugerida por ${r.criadoPorNome} em ${dia(r.criadoEm)}. ` : null}
            {r.chamado ? (
              <Link href={`/admin/chamados/${r.chamado}`} className="font-semibold text-ink underline decoration-ink/25 underline-offset-2">
                Ver o chamado {r.chamado}
              </Link>
            ) : null}
          </p>

          {podeEditar || pode.confirmar || pode.arquivar || pode.reabrir ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] pt-3">
              {pode.confirmar && r.estado === "a_confirmar" ? (
                <button type="button" disabled={ocupado} onClick={() => mudarEstado("confirmada")} className={botaoCheio}>
                  {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Confirmar
                </button>
              ) : null}
              {podeEditar ? (
                <button type="button" disabled={ocupado} onClick={() => setEditando(true)} className={botaoClaro}>
                  <Pencil size={13} aria-hidden="true" /> Editar
                </button>
              ) : null}
              {pode.reabrir ? (
                <button type="button" disabled={ocupado} onClick={() => mudarEstado("a_confirmar")} className={botaoClaro}>
                  <Undo2 size={13} aria-hidden="true" /> {r.estado === "arquivada" ? "Voltar para a confirmar" : "Tirar a confirmação"}
                </button>
              ) : null}
              {pode.arquivar && !arquivando ? (
                <button type="button" disabled={ocupado} onClick={() => setArquivando(true)} className={botaoClaro}>
                  <Archive size={13} aria-hidden="true" /> Arquivar
                </button>
              ) : null}
            </div>
          ) : null}

          {arquivando ? (
            <div className="mt-3 rounded-[12px] bg-ink/[0.04] p-3">
              <p className="text-xs leading-relaxed text-ink">
                <span className="font-semibold">Arquivar esta resposta?</span> Ela sai da lista de todo mundo. Nada é apagado: a diretoria
                continua vendo em Arquivadas e pode trazer de volta.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" disabled={ocupado} onClick={() => mudarEstado("arquivada")} className={botaoCheio}>
                  {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />} Sim, arquivar
                </button>
                <button type="button" disabled={ocupado} onClick={() => setArquivando(false)} className={botaoClaro}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {erro ? (
            <p role="alert" className="mt-2 text-xs font-semibold text-[#b01919]">
              {erro}
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

export function TelaDaBiblioteca({
  respostas, admin, meuId, destaque, sugerir, editar, definirEstado,
}: {
  respostas: Resposta[] | null;
  /** Administrador, dono ou GM: confirma, edita e arquiva. */
  admin: boolean;
  meuId: string;
  /** A resposta para onde o link de um chamado aponta. */
  destaque?: string;
  sugerir: Sugerir;
  editar: Editar;
  /** Só chega para administrador, dono e GM. */
  definirEstado?: DefinirEstado;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState<Tema | "todos">("todos");
  const [estado, setEstado] = useState<Estado | "todos">("todos");
  const [sugerindo, setSugerindo] = useState(false);
  const [enviada, setEnviada] = useState(false);

  const lista = useMemo(() => respostas ?? [], [respostas]);
  const porTema = useMemo(() => contarPorTema(lista), [lista]);
  const aConfirmar = lista.filter((r) => r.estado === "a_confirmar").length;
  const confirmadas = lista.filter((r) => r.estado === "confirmada").length;
  const arquivadas = lista.filter((r) => r.estado === "arquivada").length;

  const achadas = useMemo(() => filtrarRespostas(lista, { busca, tema, estado }), [lista, busca, tema, estado]);
  // Nada com TODAS as palavras: mostra as mais parecidas, pela mesma conta que o tutor usa.
  const parecidas = useMemo(
    () => (achadas.length === 0 && busca.trim() ? respostasProximas(busca, lista, 3).map((p) => p.resposta) : []),
    [achadas.length, busca, lista],
  );
  const semFiltro = !busca.trim() && tema === "todos" && estado === "todos";

  const abrirSugestao = () => {
    setSugerindo(true);
    setEnviada(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cartao = (r: Resposta) => (
    <CartaoDaResposta key={r.id} r={r} admin={admin} meuId={meuId} destaque={r.id === destaque} editar={editar} definirEstado={definirEstado} />
  );

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Time</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Biblioteca JK</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
            As respostas da casa. Ache a pergunta, copie a frase e cole na conversa com o cliente.
          </p>
        </div>
        {/* No celular este botão fica no fim da lista: no topo ele empurrava a busca para baixo. */}
        {!sugerindo ? (
          <button type="button" onClick={abrirSugestao} className={`${botaoClaro} hidden sm:inline-flex`}>
            <Plus size={14} aria-hidden="true" /> Sugerir uma resposta
          </button>
        ) : null}
      </header>

      {sugerindo ? (
        <section className="glass mt-4 rounded-[18px] p-4 sm:p-5" aria-label="Sugerir uma resposta">
          <p className="text-sm font-semibold text-ink">Sugerir uma resposta</p>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
            Qualquer pessoa do time pode sugerir. A resposta entra como &quot;a confirmar&quot;, já aparece para todos com esse aviso, e a
            diretoria confirma.
          </p>
          <FormularioDeResposta
            rotuloDoBotao="Enviar a sugestão"
            onSalvar={async (r) => {
              const feito = await sugerir(r);
              if (feito.ok) {
                setSugerindo(false);
                setEnviada(true);
                router.refresh();
              }
              return feito;
            }}
            onCancelar={() => setSugerindo(false)}
          />
        </section>
      ) : null}

      {enviada ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-[12px] p-3 text-sm" style={{ background: COR_DO_TOM.bom.fundo, color: COR_DO_TOM.bom.texto }}>
          <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Sugestão enviada.</span> Ela já está na lista como &quot;a confirmar&quot;.
          </span>
        </p>
      ) : null}

      {respostas === null ? (
        <p className="glass mt-5 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler a biblioteca agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          <label className="relative mt-5 block">
            <span className="sr-only">Buscar na biblioteca</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Polimento, troca, malote, Pix"
              className="h-12 w-full rounded-full border border-ink/12 bg-white pl-11 pr-11 text-base text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
            />
            {busca ? (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar a busca"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </label>

          <div className="mt-3 space-y-2">
            <FilaDeFichas rotulo="Filtrar por tema">
              <Ficha ativa={tema === "todos"} onClick={() => setTema("todos")} contagem={porTema.todos}>
                Todos
              </Ficha>
              {TEMAS.map((t) => (
                <Ficha key={t.chave} ativa={tema === t.chave} onClick={() => setTema(tema === t.chave ? "todos" : t.chave)} contagem={porTema[t.chave]}>
                  {t.nome}
                </Ficha>
              ))}
            </FilaDeFichas>
            <FilaDeFichas rotulo="Filtrar por estado">
              <Ficha ativa={estado === "todos"} onClick={() => setEstado("todos")}>
                Qualquer estado
              </Ficha>
              <Ficha ativa={estado === "confirmada"} onClick={() => setEstado(estado === "confirmada" ? "todos" : "confirmada")} contagem={confirmadas}>
                Confirmadas
              </Ficha>
              <Ficha ativa={estado === "a_confirmar"} onClick={() => setEstado(estado === "a_confirmar" ? "todos" : "a_confirmar")} contagem={aConfirmar}>
                A confirmar
              </Ficha>
              {admin && arquivadas > 0 ? (
                <Ficha ativa={estado === "arquivada"} onClick={() => setEstado(estado === "arquivada" ? "todos" : "arquivada")} contagem={arquivadas}>
                  Arquivadas
                </Ficha>
              ) : null}
            </FilaDeFichas>
          </div>

          <p className="mt-3 text-xs text-muted" aria-live="polite">
            {lista.length === 0
              ? "A biblioteca ainda está vazia."
              : achadas.length === 0
                ? parecidas.length > 0
                  ? "Nenhuma resposta com todas essas palavras. Veja as mais parecidas."
                  : "Nenhuma resposta com essas palavras."
                : semFiltro
                  ? `${plural(achadas.length, "resposta", "respostas")}. ${
                      aConfirmar === 0
                        ? "Todas confirmadas pela JK."
                        : aConfirmar === 1
                          ? "1 ainda espera a confirmação da JK."
                          : `${aConfirmar} ainda esperam a confirmação da JK.`
                    }`
                  : `${plural(achadas.length, "resposta", "respostas")}.`}
          </p>

          {achadas.length > 0 ? <ul className="mt-3 space-y-3">{achadas.map(cartao)}</ul> : null}

          {achadas.length > 0 && !sugerindo ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:hidden">
              <p className="min-w-0 flex-1 basis-40 text-xs leading-relaxed text-muted">Falta uma resposta aqui? Qualquer pessoa do time pode sugerir.</p>
              <button type="button" onClick={abrirSugestao} className={botaoClaro}>
                <Plus size={14} aria-hidden="true" /> Sugerir uma resposta
              </button>
            </div>
          ) : null}

          {achadas.length === 0 && lista.length > 0 ? (
            <div className="mt-3">
              {parecidas.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-ink">As mais parecidas com o que você digitou</p>
                  <ul className="mt-2 space-y-3">{parecidas.map(cartao)}</ul>
                </>
              ) : null}
              <div className="glass mt-3 rounded-[16px] p-4">
                <p className="text-sm font-semibold text-ink">Não achou a resposta?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Pergunte ao time por um chamado: ele chega no setor certo e fica com dono. Quando a resposta vier, ela pode virar uma entrada
                  aqui, e a próxima pessoa já encontra.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/admin/chamados?novo=duvida" className={botaoCheio}>
                    <MessagesSquare size={14} aria-hidden="true" /> Perguntar ao time
                  </Link>
                  <button type="button" onClick={abrirSugestao} className={botaoClaro}>
                    <Plus size={14} aria-hidden="true" /> Sugerir uma resposta
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
