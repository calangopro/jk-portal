"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bike, Check, Clock, ListChecks, Loader2, Search, Store, Truck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PedidoDaFabrica } from "@/lib/fabrica/dados";
import {
  ETAPAS, NOME_DA_ETAPA, NOME_DO_GRUPO, SEM_FILTRO, diasEntreDatas, esperaEmPalavra, filtrarFila, grupoDaEntrega, lerEntrega,
  lerEspecificacoes, tomDaEspera, type Entrega, type Especificacao, type Etapa, type FiltroDaFila, type GrupoDeEntrega,
} from "@/lib/fabrica/etapas";
import { nomeLimpo } from "@/lib/vendas/origem";
import { diaCurto } from "@/lib/vendas/periodo";
import { SeloDeTom } from "../Pecas";
import { AcoesDoPedido } from "./AcoesDoPedido";

/**
 * A lista de pedidos da fábrica: busca, filtros, a foto de cada peça e a
 * seleção de vários pedidos.
 *
 * TRÊS REGRAS QUE NÃO SÃO ÓBVIAS:
 *
 * 1. Sem busca, a lista é a da etapa escolhida em cima. COM busca, ela procura
 *    em todas as etapas e cada cartão diz em qual está: quem digita o número de
 *    um pedido quer saber onde ele está, e não ouvir "nenhum pedido" porque
 *    olhou a etapa errada.
 *
 * 2. A leva só mexe no que está NA TELA e marcado. Pedido marcado que um filtro
 *    escondeu depois não vai junto: ninguém move o que não está vendo.
 *
 * 3. Mover em leva pede confirmação com a contagem escrita. Um toque errado
 *    aqui anda sessenta pedidos de uma vez.
 *
 * As ações vêm de fora, como propriedade, para a tela poder ser vista sem
 * sessão durante o desenvolvimento.
 */

export type Mover = (ref: string, etapa: string, extras?: { rastreio?: string; nota?: string }) => Promise<{ ok: true } | { ok: false; erro: string }>;
export type MoverVarios = (refs: string[], etapa: string) => Promise<{ ok: true; movidos: number; fora: number } | { ok: false; erro: string }>;

/** Como o trabalho se chama no cartão: o número do pedido da loja, ou "Venda por fora". */
const nomeDoTrabalho = (p: PedidoDaFabrica) => (p.pedido !== null ? `Pedido ${p.pedido}` : "Venda por fora");

const ICONE_DA_ENTREGA: Record<Entrega["tipo"], LucideIcon> = { retirada: Store, motoboy: Bike, correios: Truck, envio: Truck };
const GRUPOS: GrupoDeEntrega[] = ["retirada", "motoboy", "envio"];

/** A loja marcou o pedido como saído: a fábrica não tem mais o que mover. */
const SAIU_PELA_LOJA = new Set(["ENVIADO", "FINALIZADO", "PROBLEMAS NA ENTREGA"]);
const saiuPelaLoja = (p: PedidoDaFabrica) => SAIU_PELA_LOJA.has((p.statusDaLoja ?? "").toUpperCase());

const rotuloCurto = (rotulo: string) => rotulo.replace(/^(?:Numeração|Gravação)\s*-?\s*/i, "").trim() || rotulo;
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

type Zoom = { src: string; nome: string };

function Especificacoes({ lista }: { lista: Especificacao[] }) {
  const aros = lista.filter((e) => e.tipo === "aro");
  const gravar = lista.filter((e) => e.tipo === "gravar");
  const outros = lista.filter((e) => e.tipo === "outro");
  if (lista.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {aros.length > 0 ? (
        <dl className="flex flex-wrap gap-1.5">
          {aros.map((e, i) => (
            <div key={i} className="painel-selo flex items-baseline gap-1.5 rounded-[9px] px-2.5 py-1">
              <dt className="text-[0.68rem] font-semibold">{rotuloCurto(e.rotulo)}</dt>
              <dd className="numeros text-base font-bold leading-none text-ink">{e.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {gravar.length > 0 ? (
        <div className="rounded-[10px] border border-ink/15 bg-white p-2.5">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Gravar</p>
          <dl className="mt-1 space-y-1">
            {gravar.map((e, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-2">
                <dt className="shrink-0 text-xs text-muted">{rotuloCurto(e.rotulo)}</dt>
                {/* O texto vai como o cliente escreveu: é o que será gravado na peça. */}
                <dd className="min-w-0 whitespace-pre-wrap break-words text-base font-bold leading-snug text-ink">{e.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {outros.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {outros.map((e, i) => (
            <div key={i} className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-muted">{e.rotulo}:</dt>
              <dd className="min-w-0 break-words font-medium text-ink">{e.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function CartaoDoPedido({
  p, hoje, mover, mostrarEtapa, escolhendo, marcado, onMarcar, onZoom,
}: {
  p: PedidoDaFabrica;
  hoje: string;
  mover: Mover;
  /** Na busca, o cartão diz em que etapa o pedido está. */
  mostrarEtapa: boolean;
  escolhendo: boolean;
  marcado: boolean;
  onMarcar: () => void;
  onZoom: (z: Zoom) => void;
}) {
  const dias = diasEntreDatas(p.dia, hoje);
  const tom = tomDaEspera(dias, p.etapa);
  const entrega = lerEntrega(p.entrega);
  const IconeDaEntrega = entrega ? ICONE_DA_ENTREGA[entrega.tipo] : null;
  const peloLoja = saiuPelaLoja(p);
  const escolhivel = escolhendo && !peloLoja;

  return (
    <li className={`glass relative flex flex-col rounded-[16px] p-4 ${marcado ? "outline outline-2 outline-[var(--setor)]" : ""}`}>
      {/* Na seleção, o cartão inteiro é o botão: com a peça numa mão, ninguém acerta uma caixinha de 20 px. */}
      {escolhivel ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={marcado}
          aria-label={`Escolher: ${nomeDoTrabalho(p)}${p.pedido === null && p.cliente ? `, ${p.cliente}` : ""}`}
          onClick={onMarcar}
          className="absolute inset-0 z-10 rounded-[16px]"
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-start gap-2.5">
          {escolhivel ? (
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2 ${marcado ? "painel-aba-ativa border-transparent" : "border-ink/30 bg-white"}`}
            >
              {marcado ? <Check size={15} strokeWidth={3} /> : null}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="numeros text-base font-bold leading-tight text-ink">{nomeDoTrabalho(p)}</p>
            <p className="mt-0.5 break-words text-xs text-muted">
              {p.cliente ?? "Cliente sem nome"}
              {p.cidade ? `, ${p.cidade}${p.uf ? ` (${p.uf})` : ""}` : ""}
            </p>
            {/* Venda por fora não está na loja: a dúvida da fábrica vai para quem vendeu. */}
            {p.origem === "por_fora" ? (
              <p className="mt-0.5 text-xs font-semibold text-[var(--setor)]">{p.vendedor ? `Vendida por ${p.vendedor}, fora da loja` : "Vendida fora da loja"}</p>
            ) : null}
          </div>
        </div>
        <SeloDeTom tom={tom} titulo={`Pago em ${diaCurto(p.dia)}`}>
          {/* Com tom, o selo já traz o ícone do tom: dois ícones lado a lado só confundem. */}
          {tom === "neutro" ? <Clock size={11} aria-hidden="true" /> : null} {diaCurto(p.dia)}, {esperaEmPalavra(dias)}
        </SeloDeTom>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {mostrarEtapa ? (
          <p className="painel-selo inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold">{NOME_DA_ETAPA[p.etapa]}</p>
        ) : null}
        {entrega && IconeDaEntrega ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-2.5 py-1 text-xs font-semibold text-ink">
            <IconeDaEntrega size={13} className="shrink-0" aria-hidden="true" /> {entrega.nome}
          </p>
        ) : null}
      </div>

      <ul className="mt-3 space-y-3 border-t border-ink/[0.07] pt-3">
        {p.pecas.map((peca, i) => {
          const nome = nomeLimpo(peca.nome);
          return (
            <li key={i}>
              <div className="flex items-start gap-3">
                {peca.miniatura ? (
                  <button
                    type="button"
                    onClick={() => onZoom({ src: peca.foto ?? peca.miniatura ?? "", nome })}
                    aria-label={`Ampliar a foto de ${nome}`}
                    // Fica por cima do botão de seleção: ver a foto não pode marcar o pedido.
                    className="painel-toque relative z-20 shrink-0 rounded-[10px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={peca.miniatura}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="h-16 w-16 rounded-[10px] border border-ink/10 bg-white object-contain"
                    />
                  </button>
                ) : (
                  <span className="h-16 w-16 shrink-0 rounded-[10px] bg-ink/[0.05]" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-snug text-ink">
                    <span className="numeros">{peca.quantidade}×</span> {nome}
                  </p>
                  {peca.referencia ? <p className="numeros text-[0.7rem] text-muted">Ref. {peca.referencia}</p> : null}
                </div>
              </div>
              <Especificacoes lista={lerEspecificacoes(peca.info)} />
            </li>
          );
        })}
      </ul>

      {p.endereco ? (
        <p className="mt-3 break-words rounded-[10px] border border-ink/10 bg-white p-2.5 text-xs leading-relaxed text-ink">
          <span className="font-bold">Entregar em:</span> {p.endereco}
        </p>
      ) : null}
      {p.nota ? (
        <p className="mt-3 rounded-[10px] bg-[#fcefd9] p-2.5 text-xs leading-relaxed text-[#6d3505]">
          <span className="font-bold">Anotação:</span> {p.nota}
        </p>
      ) : null}
      {p.rastreio ? <p className="numeros mt-2 text-xs text-ink">Rastreio: <span className="font-semibold">{p.rastreio}</span></p> : null}
      {p.movidoPor && p.etapaEm ? (
        <p className="mt-2 text-[0.7rem] text-muted">
          {NOME_DA_ETAPA[p.etapa]} desde {new Date(p.etapaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}, por {p.movidoPor}.
        </p>
      ) : null}

      <div className="mt-auto pt-3">
        {peloLoja ? (
          <p className="text-xs text-muted">A loja já marcou este pedido como {(p.statusDaLoja ?? "").toLowerCase()}.</p>
        ) : escolhendo ? null : (
          <AcoesDoPedido pedido={p.ref} etapa={p.etapa} nota={p.nota} rastreio={p.rastreio} mover={mover} />
        )}
      </div>
    </li>
  );
}

function Filtro({ ativo, onClick, children, numero, tom }: { ativo: boolean; onClick: () => void; children: React.ReactNode; numero: number; tom?: "ruim" }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`painel-toque inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold ${
        ativo ? "painel-aba-ativa" : "border border-ink/12 bg-white text-ink"
      }`}
    >
      {children}
      <span className={`numeros ${ativo ? "opacity-85" : tom === "ruim" ? "text-[#b01919]" : "text-muted"}`}>{numero}</span>
    </button>
  );
}

export function ListaDaFabrica({
  pedidos, etapa, hoje, mover, moverVarios,
}: {
  /** Todos os pedidos da janela, de todas as etapas: a busca procura em todos. */
  pedidos: PedidoDaFabrica[];
  etapa: Etapa;
  hoje: string;
  mover: Mover;
  moverVarios: MoverVarios;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroDaFila>(SEM_FILTRO);
  const [escolhendo, setEscolhendo] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [destino, setDestino] = useState<Etapa | null>(null);
  const [ocupado, comecar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const [zoom, setZoom] = useState<Zoom | null>(null);

  const buscando = filtro.busca.trim().length > 0;

  // Em "Enviado" a ordem inverte, para o que acabou de sair ficar em cima.
  const daEtapa = useMemo(() => {
    const l = pedidos.filter((p) => p.etapa === etapa);
    return etapa === "enviado" ? l.reverse() : l;
  }, [pedidos, etapa]);

  const visiveis = useMemo(() => filtrarFila(buscando ? pedidos : daEtapa, filtro, hoje), [buscando, pedidos, daEtapa, filtro, hoje]);

  const contagem = useMemo(() => {
    const c: Record<GrupoDeEntrega, number> = { retirada: 0, motoboy: 0, envio: 0 };
    let atrasados = 0;
    let comNota = 0;
    for (const p of daEtapa) {
      const g = grupoDaEntrega(p.entrega);
      if (g) c[g]++;
      if (tomDaEspera(diasEntreDatas(p.dia, hoje), p.etapa) === "ruim") atrasados++;
      if (p.nota) comNota++;
    }
    return { ...c, atrasados, comNota };
  }, [daEtapa, hoje]);

  // Trocou de etapa: a seleção era da lista anterior.
  useEffect(() => {
    setMarcados(new Set());
    setDestino(null);
  }, [etapa]);

  useEffect(() => {
    if (!zoom) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [zoom]);

  const moveis = visiveis.filter((p) => !saiuPelaLoja(p));
  const escolhidos = moveis.filter((p) => marcados.has(p.ref));
  const temFiltro = buscando || filtro.entrega !== "todas" || filtro.soAtrasados || filtro.soComNota;

  const alternar = (ref: string) =>
    setMarcados((antes) => {
      const depois = new Set(antes);
      if (depois.has(ref)) depois.delete(ref);
      else depois.add(ref);
      return depois;
    });

  const sairDaSelecao = () => {
    setEscolhendo(false);
    setMarcados(new Set());
    setDestino(null);
  };

  const moverEscolhidos = (para: Etapa) =>
    comecar(async () => {
      setAviso(null);
      const r = await moverVarios(escolhidos.map((p) => p.ref), para);
      if (!r.ok) {
        setAviso({ tom: "ruim", texto: r.erro });
        return;
      }
      const fora = r.fora > 0 ? ` ${plural(r.fora, "ficou de fora por não estar pago", "ficaram de fora por não estarem pagos")}.` : "";
      setAviso({ tom: "bom", texto: `${plural(r.movidos, "pedido foi", "pedidos foram")} para ${NOME_DA_ETAPA[para]}.${fora}` });
      sairDaSelecao();
      router.refresh();
    });

  // 36 px de altura: a barra da seleção gruda no topo e, mais alta, tomava um quarto da tela do celular.
  const botaoClaro = "painel-toque inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60";

  return (
    <div className="mt-3">
      {/* Busca e seleção na mesma linha, também no celular: cada linha a mais empurra o primeiro pedido para baixo. */}
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar na fila</span>
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={filtro.busca}
            onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
            placeholder="Buscar pedido, cliente, peça ou gravação"
            aria-description="Procura em todas as etapas, também por loja de retirada, referência, rastreio e anotação."
            className="h-11 w-full rounded-full border border-ink/12 bg-white pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
          />
        </label>
        <button
          type="button"
          aria-pressed={escolhendo}
          onClick={() => (escolhendo ? sairDaSelecao() : setEscolhendo(true))}
          className={`painel-toque inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${escolhendo ? "painel-aba-ativa" : "border border-ink/12 bg-white text-ink"}`}
        >
          {escolhendo ? <X size={15} aria-hidden="true" /> : <ListChecks size={15} aria-hidden="true" />}
          {escolhendo ? "Sair" : "Marcar vários"}
        </button>
      </div>

      {!buscando ? (
        // No celular os filtros ficam numa linha só, que rola de lado. Quebrando, eram três linhas antes do primeiro pedido.
        <div className="painel-fila -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Filtrar a lista">
          <Filtro ativo={filtro.entrega === "todas"} onClick={() => setFiltro({ ...filtro, entrega: "todas" })} numero={daEtapa.length}>
            Todas as entregas
          </Filtro>
          {GRUPOS.filter((g) => contagem[g] > 0).map((g) => (
            <Filtro key={g} ativo={filtro.entrega === g} onClick={() => setFiltro({ ...filtro, entrega: filtro.entrega === g ? "todas" : g })} numero={contagem[g]}>
              {NOME_DO_GRUPO[g]}
            </Filtro>
          ))}
          {contagem.atrasados > 0 ? (
            <Filtro ativo={filtro.soAtrasados} onClick={() => setFiltro({ ...filtro, soAtrasados: !filtro.soAtrasados })} numero={contagem.atrasados} tom="ruim">
              Atrasados
            </Filtro>
          ) : null}
          {contagem.comNota > 0 ? (
            <Filtro ativo={filtro.soComNota} onClick={() => setFiltro({ ...filtro, soComNota: !filtro.soComNota })} numero={contagem.comNota}>
              Com anotação
            </Filtro>
          ) : null}
        </div>
      ) : null}

      {escolhendo ? (
        <div className="sticky top-[calc(var(--painel-topo,3.5rem)+0.5rem)] z-30 mt-3 rounded-[14px] border border-ink/12 bg-white p-3 shadow-[0_8px_24px_rgba(26,24,21,0.12)]">
          {destino ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 basis-48 text-sm font-semibold text-ink">
                Levar {plural(escolhidos.length, "pedido", "pedidos")} para {NOME_DA_ETAPA[destino]}?
              </p>
              <button type="button" disabled={ocupado} onClick={() => moverEscolhidos(destino)} className="painel-toque painel-aba-ativa inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold disabled:opacity-60">
                {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Confirmar
              </button>
              <button type="button" disabled={ocupado} onClick={() => setDestino(null)} className={botaoClaro}>
                Voltar
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-sm font-semibold text-ink" aria-live="polite">
                  {escolhidos.length === 0 ? "Toque nos pedidos para escolher" : plural(escolhidos.length, "escolhido", "escolhidos")}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  {moveis.length > 0 && escolhidos.length < moveis.length ? (
                    <button type="button" onClick={() => setMarcados(new Set(moveis.map((p) => p.ref)))} className={botaoClaro}>
                      Todos os {moveis.length}
                    </button>
                  ) : null}
                  {escolhidos.length > 0 ? (
                    <button type="button" onClick={() => setMarcados(new Set())} className={botaoClaro}>
                      Limpar
                    </button>
                  ) : null}
                </div>
              </div>
              {escolhidos.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink/[0.07] pt-2">
                  <span className="text-xs text-muted">Levar para</span>
                  {ETAPAS.filter((e) => buscando || e.chave !== etapa).map((e) => (
                    <button
                      key={e.chave}
                      type="button"
                      onClick={() => setDestino(e.chave)}
                      className={e.chave === "enviado" ? "painel-toque painel-aba-ativa inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-xs font-semibold" : botaoClaro}
                    >
                      {e.nome}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {aviso ? (
        <p
          role="status"
          className={`mt-3 rounded-[12px] p-3 text-sm font-semibold ${aviso.tom === "bom" ? "bg-[#e3f4ec] text-[#046c4e]" : "bg-[#fde8e8] text-[#b01919]"}`}
        >
          {aviso.texto}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted" aria-live="polite">
        {buscando
          ? `${visiveis.length === 0 ? "Nenhum pedido" : plural(visiveis.length, "pedido", "pedidos")} com "${filtro.busca.trim()}", em todas as etapas.`
          : temFiltro
            ? `${visiveis.length} de ${plural(daEtapa.length, "pedido", "pedidos")} nesta etapa.`
            : `${daEtapa.length === 0 ? "Nenhum pedido" : plural(daEtapa.length, "pedido", "pedidos")} nesta etapa.`}
        {temFiltro ? (
          <button type="button" onClick={() => setFiltro(SEM_FILTRO)} className="ml-2 font-semibold text-ink underline underline-offset-2">
            Limpar filtros
          </button>
        ) : null}
      </p>

      {visiveis.length === 0 ? (
        <p className="glass mt-3 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">{temFiltro ? "Nenhum pedido com esse filtro." : "Nenhum pedido nesta etapa."}</span>{" "}
          {temFiltro
            ? "Confira o que foi digitado ou limpe os filtros."
            : etapa === "a_produzir"
              ? "Pedido novo entra aqui sozinho, quando a loja confirma o pagamento."
              : "Os pedidos aparecem aqui conforme andam na fila."}
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {visiveis.map((p) => (
            <CartaoDoPedido
              key={p.ref}
              p={p}
              hoje={hoje}
              mover={mover}
              mostrarEtapa={buscando}
              escolhendo={escolhendo}
              marcado={marcados.has(p.ref) && !saiuPelaLoja(p)}
              onMarcar={() => alternar(p.ref)}
              onZoom={setZoom}
            />
          ))}
        </ul>
      )}

      {zoom ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${zoom.nome}`}
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#1a1815]/85 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.nome} className="max-h-[78dvh] max-w-full rounded-[14px] bg-white object-contain" />
          <p className="max-w-xl text-center text-sm font-semibold text-white">{zoom.nome}</p>
          <button
            type="button"
            autoFocus
            onClick={() => setZoom(null)}
            className="painel-toque inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink"
          >
            <X size={16} aria-hidden="true" /> Fechar
          </button>
        </div>
      ) : null}
    </div>
  );
}
