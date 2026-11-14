"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AtSign, Loader2, Package, Slash, Target, Users } from "lucide-react";
import { ROLE_LABEL, type AppRole } from "@/lib/auth/acessos";
import type { Tom } from "@/lib/painel/tons";
import {
  buscaDoPedido, comandosPara, diaCurto, gatilhoNoCursor, situacaoDoPedido, sugestoesDeArroba, trocarGatilho,
  type PedidoAchado, type Pessoa,
} from "@/lib/time/chat";
import { SeloDeTom } from "../Pecas";

/**
 * As sugestões que aparecem em cima do campo de escrever quando a pessoa
 * digita "@" (pessoa ou setor) ou "/" (comando).
 *
 *   @        lista os setores e as pessoas; segue filtrando enquanto ela digita.
 *   /        lista os comandos: `/pedido` e, para quem pode ver a meta, `/meta`.
 *   /pedido  vira busca: o número do pedido, ou o nome do cliente para quem já
 *            vê cliente em outra tela. Sem nada digitado, os mais recentes.
 *
 * Escolher troca o que foi digitado pelo que se lê (`@Caio Reis`, `#11389`,
 * `/meta`). A marcação de verdade só nasce na hora de mandar (`comMarcas`), e
 * quem confere é o banco.
 *
 * Setas andam na lista, Enter ou Tab escolhem, Esc fecha. Com a lista aberta,
 * o Enter NÃO envia a mensagem: é o que impede mandar "@ca" pela metade.
 */

export type BuscarPedidos = (busca: string) => Promise<PedidoAchado[]>;

type Item = {
  chave: string;
  visivel: string;
  titulo: string;
  apoio: string;
  tipo: "pessoa" | "setor" | "comando" | "pedido";
  selo?: { tom: Tom; palavra: string };
  /** O comando do pedido não fecha a lista: ele abre a busca. */
  segue?: boolean;
};

const nomeDoPapel = (papel: string) => ROLE_LABEL[papel as AppRole] ?? papel;

export function useSugestoes({
  texto, onTexto, campo, pessoas, meuId, podeMeta, buscarPedidos,
}: {
  texto: string;
  onTexto: (t: string) => void;
  campo: React.RefObject<HTMLTextAreaElement | null>;
  pessoas: readonly Pessoa[];
  meuId: string;
  podeMeta: boolean;
  buscarPedidos: BuscarPedidos;
}) {
  const [cursor, setCursor] = useState(0);
  /** O texto em que a pessoa fechou a lista (ou escolheu): enquanto ele não mudar, a lista não volta. */
  const [dispensado, setDispensado] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);
  const [achados, setAchados] = useState<PedidoAchado[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const gatilho = useMemo(() => (dispensado === texto ? null : gatilhoNoCursor(texto, cursor)), [texto, cursor, dispensado]);
  const busca = gatilho?.tipo === "comando" ? buscaDoPedido(gatilho.termo) : null;

  // A busca do pedido vai ao banco, com um respiro para não pedir a cada letra.
  useEffect(() => {
    if (busca === null) {
      setAchados(null);
      setBuscando(false);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const id = setTimeout(
      async () => {
        const lista = await buscarPedidos(busca);
        if (!vivo) return;
        setAchados(lista);
        setBuscando(false);
      },
      busca === "" ? 0 : 250,
    );
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [busca, buscarPedidos]);

  const itens = useMemo<Item[]>(() => {
    if (!gatilho) return [];
    if (gatilho.tipo === "arroba") {
      return sugestoesDeArroba(gatilho.termo, pessoas, meuId, nomeDoPapel).map((s) => ({ ...s, tipo: s.chave.startsWith("s:") ? ("setor" as const) : ("pessoa" as const) }));
    }
    if (busca !== null) {
      return (achados ?? []).map((p) => ({
        chave: `o:${p.numero}`,
        visivel: `#${p.numero}`,
        titulo: `Pedido ${p.numero}`,
        apoio: [p.cliente, p.peca, diaCurto(p.dia)].filter(Boolean).join(" · "),
        tipo: "pedido" as const,
        selo: situacaoDoPedido(p),
      }));
    }
    return comandosPara(gatilho.termo, podeMeta).map((c) => ({ ...c, tipo: "comando" as const, segue: c.chave === "pedido" }));
  }, [gatilho, busca, achados, pessoas, meuId, podeMeta]);

  // A escolha volta ao primeiro item quando a lista muda.
  const assinatura = itens.map((i) => i.chave).join("|");
  useEffect(() => setAtivo(0), [assinatura]);

  const proximoCursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = campo.current;
    if (el && proximoCursor.current !== null) {
      el.focus();
      el.setSelectionRange(proximoCursor.current, proximoCursor.current);
      proximoCursor.current = null;
    }
  }, [texto, campo]);

  const escolher = (item: Item) => {
    if (!gatilho) return;
    const novo = item.visivel.endsWith(" ") ? item.visivel : `${item.visivel} `;
    const r = trocarGatilho(texto, gatilho, novo);
    proximoCursor.current = r.cursor;
    setCursor(r.cursor);
    setDispensado(item.segue ? null : r.texto);
    onTexto(r.texto);
  };

  /**
   * A lista está na tela: com itens, ou na busca do pedido (que mostra
   * "buscando" e "nada achado"). Busca de várias palavras que não achou nada
   * fecha: a pessoa já está escrevendo a frase, não procurando um pedido.
   */
  const aberta = gatilho !== null && (itens.length > 0 || (busca !== null && (buscando || !/\s/.test(busca))));

  /** Para pôr no `onKeyDown` do campo, ANTES do Enter que envia. Devolve verdadeiro quando a tecla era da lista. */
  const aoTeclar = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!aberta) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      setDispensado(texto);
      return true;
    }
    if (itens.length === 0) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length);
      return true;
    }
    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
      e.preventDefault();
      escolher(itens[Math.min(ativo, itens.length - 1)]);
      return true;
    }
    return false;
  };

  /** Para pôr no `onSelect` e no `onChange` do campo: a lista depende de onde o cursor está. */
  const aoMoverCursor = (el: HTMLTextAreaElement) => setCursor(el.selectionStart ?? el.value.length);

  return { aberta, itens, ativo, buscando, emBusca: busca !== null, busca, escolher, aoTeclar, aoMoverCursor, setAtivo };
}

const ICONE: Record<Item["tipo"], typeof AtSign> = { pessoa: AtSign, setor: Users, comando: Slash, pedido: Package };

export function ListaDeSugestoes({ s, id }: { s: ReturnType<typeof useSugestoes>; id: string }) {
  if (!s.aberta) return null;
  return (
    <div
      id={id}
      role="listbox"
      aria-label={s.emBusca ? "Pedidos achados" : "Sugestões"}
      className="absolute inset-x-2.5 bottom-full z-10 mb-1 max-h-64 overflow-y-auto rounded-[14px] border border-ink/10 bg-white p-1 shadow-[0_-10px_30px_-14px_rgb(23_21_18/0.45)] sm:inset-x-4"
    >
      {s.emBusca ? (
        <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[0.68rem] leading-snug text-muted">
          {s.buscando ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Package size={11} aria-hidden="true" />}
          {s.busca === "" ? "Pedidos mais recentes. Digite o número ou o nome do cliente." : s.buscando ? "Buscando" : `Pedidos para "${s.busca}"`}
        </p>
      ) : null}
      {s.itens.map((item, i) => {
        const Icone = item.chave === "meta" ? Target : ICONE[item.tipo];
        return (
          <button
            key={item.chave}
            type="button"
            role="option"
            aria-selected={i === s.ativo}
            // O toque não pode tirar o foco do campo: o teclado do celular fecharia antes de a escolha entrar.
            onPointerDown={(e) => e.preventDefault()}
            onMouseEnter={() => s.setAtivo(i)}
            onClick={() => s.escolher(item)}
            className={`flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left ${i === s.ativo ? "painel-item-ativo" : ""}`}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${i === s.ativo ? "bg-white/70" : "bg-ink/[0.05]"}`} aria-hidden="true">
              <Icone size={13} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{item.titulo}</span>
              {item.apoio ? <span className={`block truncate text-[0.7rem] leading-tight ${i === s.ativo ? "opacity-80" : "text-muted"}`}>{item.apoio}</span> : null}
            </span>
            {item.selo ? <SeloDeTom tom={item.selo.tom}>{item.selo.palavra}</SeloDeTom> : null}
          </button>
        );
      })}
      {s.emBusca && !s.buscando && s.itens.length === 0 ? (
        <p className="px-2.5 pb-2 pt-1 text-xs leading-relaxed text-muted">
          Nenhum pedido achado. A busca pelo nome do cliente vale para quem já vê cliente em outra tela do painel; pelo número, vale para todos.
        </p>
      ) : null}
    </div>
  );
}
