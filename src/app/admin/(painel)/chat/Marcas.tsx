"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CircleAlert, CircleCheck, Contact, Hammer, Loader2, Package, Target } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { diaCurto, situacaoDaMeta, situacaoDoPedido, type Marca, type PreviaDoPedido } from "@/lib/time/chat";
import { SeloDeTom } from "../Pecas";

/**
 * A marcação desenhada dentro da mensagem: uma pessoa, um setor, a meta do
 * mês ou um pedido da loja.
 *
 * PESSOA E SETOR são só o nome com a cor do setor; quando a marcação é para
 * quem está lendo (o nome dela, ou um setor a que ela responde), ganha fundo.
 *
 * A META mostra o percentual e a situação como estavam na hora da mensagem.
 * Nunca valor em reais: o chat é lido por quem não vê faturamento.
 *
 * O PEDIDO é um botão. Passar o mouse (ou tocar, ou dar Enter) abre a prévia
 * em cima dele. A prévia é pedida ao banco na hora e vem montada para QUEM
 * OLHA: peças, etapa e entrega para todos; cliente e valor só para quem tem o
 * acesso. Ela é desenhada fora da conversa (num portal no `body`), porque a
 * conversa rola por dentro de uma caixa que cortaria a prévia.
 */

export type BuscarPrevia = (numero: number) => Promise<PreviaDoPedido | null>;

const chip = "rounded-[6px] px-1 py-px font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

/** O nome de uma pessoa ou de um setor marcado. Com fundo quando é para quem lê. */
function Nome({ rotulo, paraMim }: { rotulo: string; paraMim: boolean }) {
  return (
    <span
      className={`${chip} painel-cor`}
      style={paraMim ? { background: "color-mix(in srgb, var(--setor) 16%, #fff)" } : undefined}
      title={paraMim ? "Esta marcação é para você" : undefined}
    >
      @{rotulo}
    </span>
  );
}

/** A meta do mês, como estava na hora da mensagem: percentual e situação, com ícone e palavra. */
function MetaMarcada({ marca }: { marca: Extract<Marca, { tipo: "meta" }> }) {
  const s = situacaoDaMeta(marca.situacao);
  const Icone = s.tom === "bom" ? CircleCheck : CircleAlert;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-[8px] border border-ink/10 bg-white px-1.5 py-0.5 align-baseline text-[0.85em] leading-snug">
      <Target size={12} className="painel-cor shrink-0" aria-hidden="true" />
      <span className="font-semibold text-ink">{marca.rotulo}</span>
      <span className="inline-flex items-center gap-1 font-bold" style={{ color: COR_DO_TOM[s.tom].texto }}>
        <Icone size={11} aria-hidden="true" /> {s.palavra}
      </span>
    </span>
  );
}

/** A prévia guardada por um minuto: passar o mouse de novo não vai ao banco outra vez, e a etapa não fica velha. */
const guardadas = new Map<number, { em: number; previa: PreviaDoPedido | null }>();
const VALE_POR_MS = 60_000;

const emReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CorpoDaPrevia({ previa, numero }: { previa: PreviaDoPedido | null | undefined; numero: number }) {
  if (previa === undefined) {
    return (
      <p role="status" className="flex items-center gap-2 py-3 text-xs text-ink/70">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Buscando o pedido {numero}
      </p>
    );
  }
  if (previa === null) return <p className="py-2 text-xs leading-relaxed text-ink/70">Não achei o pedido {numero}, ou não deu para falar com o servidor agora.</p>;

  const situacao = situacaoDoPedido(previa);
  const onde = [previa.cidade, previa.uf].filter(Boolean).join(", ");
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-bold text-ink">Pedido {previa.numero}</span>
        <SeloDeTom tom={situacao.tom}>{situacao.palavra}</SeloDeTom>
        {previa.dia ? <span className="numeros text-[0.7rem] text-ink/60">{diaCurto(previa.dia)}</span> : null}
      </p>
      {previa.cliente || onde ? (
        <p className="mt-1 text-xs leading-snug text-ink/80">
          {previa.cliente ? <span className="font-semibold text-ink">{previa.cliente}</span> : null}
          {previa.cliente && onde ? " · " : null}
          {onde}
        </p>
      ) : null}

      {previa.pecas.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {previa.pecas.slice(0, 4).map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              {p.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.foto} alt="" loading="lazy" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[8px] border border-ink/10 bg-white object-cover" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-ink/[0.05] text-ink/40" aria-hidden="true">
                  <Package size={14} />
                </span>
              )}
              <span className="min-w-0 text-xs leading-snug text-ink">
                {p.quantidade > 1 ? <span className="numeros font-bold">{p.quantidade}× </span> : null}
                {p.nome}
              </span>
            </li>
          ))}
          {previa.pecas.length > 4 ? <li className="text-[0.7rem] text-ink/60">e mais {previa.pecas.length - 4}</li> : null}
        </ul>
      ) : null}

      <dl className="mt-2 space-y-0.5 text-[0.72rem] leading-snug text-ink/75">
        {previa.entrega ? (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold text-ink">Entrega:</dt>
            <dd className="min-w-0 break-words">{previa.entrega}</dd>
          </div>
        ) : null}
        {previa.rastreio ? (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold text-ink">Rastreio:</dt>
            <dd className="numeros min-w-0 break-all">{previa.rastreio}</dd>
          </div>
        ) : null}
        {previa.total !== null ? (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold text-ink">Total:</dt>
            <dd className="numeros">{emReais(previa.total)}</dd>
          </div>
        ) : null}
      </dl>

      {previa.pode.fabrica || previa.pode.ficha ? (
        <p className="mt-2.5 flex flex-wrap gap-1.5 border-t border-ink/[0.08] pt-2.5">
          {previa.pode.fabrica ? (
            <Link href={`/admin/fabrica?busca=${previa.numero}`} className="inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink">
              <Hammer size={12} aria-hidden="true" /> Ver na fábrica
            </Link>
          ) : null}
          {previa.pode.ficha ? (
            <Link href={`/admin/clientes/p${previa.numero}`} className="inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink">
              <Contact size={12} aria-hidden="true" /> Ficha do cliente
            </Link>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

const LARGURA_DA_PREVIA = 304;

function PedidoMarcado({ numero, buscar }: { numero: number; buscar: BuscarPrevia }) {
  const [aberta, setAberta] = useState(false);
  const [previa, setPrevia] = useState<PreviaDoPedido | null | undefined>(undefined);
  const [lugar, setLugar] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const semRelogio = () => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
  };
  useEffect(() => semRelogio, []);

  const abrir = useCallback(() => {
    semRelogio();
    setAberta(true);
    const guardada = guardadas.get(numero);
    if (guardada && Date.now() - guardada.em < VALE_POR_MS) return setPrevia(guardada.previa);
    setPrevia(undefined);
    void buscar(numero).then((p) => {
      // Falha de rede não fica guardada: a próxima vez tenta de novo.
      if (p) guardadas.set(numero, { em: Date.now(), previa: p });
      setPrevia(p);
    });
  }, [numero, buscar]);
  const fechar = useCallback(() => {
    semRelogio();
    setAberta(false);
  }, []);

  // A prévia fica em cima do pedido; sem espaço em cima, vai para baixo. Nunca sai pela lateral da janela.
  useLayoutEffect(() => {
    if (!aberta || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - LARGURA_DA_PREVIA - 8));
    setLugar(r.top > 300 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  }, [aberta, previa]);

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !caixa.current?.contains(alvo)) fechar();
    };
    // A conversa rolou: a prévia ficaria apontando para onde o pedido não está mais.
    const rolou = (e: Event) => {
      if (!caixa.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora);
    window.addEventListener("scroll", rolou, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("scroll", rolou, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberta, fechar]);

  // O mouse: abre depois de um instante parado em cima, e dá tempo de descer do pedido para a prévia sem ela fechar.
  const entrou = () => {
    semRelogio();
    if (!aberta) relogio.current = setTimeout(abrir, 220);
  };
  const saiu = () => {
    semRelogio();
    relogio.current = setTimeout(fechar, 240);
  };
  const somenteMouse = (f: () => void) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") f();
  };

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberta}
        onClick={(e) => {
          e.stopPropagation();
          if (aberta) fechar();
          else abrir();
        }}
        onPointerEnter={somenteMouse(entrou)}
        onPointerLeave={somenteMouse(saiu)}
        className="painel-toque painel-cor inline-flex items-center gap-1 rounded-[8px] border border-ink/10 bg-white px-1.5 py-0.5 align-baseline text-[0.85em] font-semibold leading-snug"
      >
        <Package size={12} className="shrink-0" aria-hidden="true" />
        Pedido <span className="numeros">{numero}</span>
      </button>
      {aberta && lugar
        ? createPortal(
            <div
              ref={caixa}
              role="dialog"
              aria-label={`Pedido ${numero}`}
              onPointerEnter={somenteMouse(semRelogio)}
              onPointerLeave={somenteMouse(saiu)}
              onClick={(e) => e.stopPropagation()}
              style={{ position: "fixed", width: LARGURA_DA_PREVIA, maxWidth: "calc(100vw - 16px)", ...lugar }}
              className="z-[60] rounded-[14px] border border-ink/10 bg-white p-3 text-ink shadow-[0_18px_44px_-18px_rgb(23_21_18/0.55)]"
            >
              <CorpoDaPrevia previa={previa} numero={numero} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Uma marcação dentro do texto da mensagem. */
export function MarcaNoTexto({
  marca, meuId, meusSetores, buscarPrevia,
}: {
  marca: Marca;
  meuId: string;
  meusSetores: readonly string[];
  buscarPrevia?: BuscarPrevia;
}) {
  if (marca.tipo === "pessoa") return <Nome rotulo={marca.rotulo} paraMim={marca.id === meuId.toLowerCase()} />;
  if (marca.tipo === "setor") return <Nome rotulo={marca.rotulo} paraMim={meusSetores.includes(marca.setor)} />;
  if (marca.tipo === "meta") return <MetaMarcada marca={marca} />;
  // Sem como buscar a prévia (a mensagem que ainda está indo), o pedido é só o nome.
  if (!buscarPrevia) return <span className={`${chip} painel-cor`}>Pedido {marca.numero}</span>;
  return <PedidoMarcado numero={marca.numero} buscar={buscarPrevia} />;
}
